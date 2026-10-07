// Bench acquisition prototype. Bias stays OFF until per-sensor calibration is
// implemented and reviewed; this firmware never asserts HV_EN.
#include <inttypes.h>
#include <stdio.h>
#include <string.h>
#include <stdatomic.h>
#include "driver/gpio.h"
#include "driver/spi_master.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_rom_sys.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include "lwip/sockets.h"
#include "nvs_flash.h"
#include "muon_protocol.h"
#ifndef CONFIG_MUON_WIFI_SSID
#define CONFIG_MUON_WIFI_SSID ""
#endif

enum { HV_EN=12, INJ=13, CFG_CS=10, CFG_MOSI=11, CFG_SCK=14,
       CRESET=15, CDONE=16, SPI_CS=17, SPI_SCK=21, SPI_MOSI=38,
       SPI_MISO=39, IRQ=40, ACQ_RESET=41, MUX_RESET=42 };
extern const unsigned char muon_fpga_image[];
extern const size_t muon_fpga_image_size;
static spi_device_handle_t fpga;
static QueueHandle_t packets;
static atomic_uint_fast32_t software_drops, udp_errors;
static atomic_bool wifi_ready;
static uint32_t epoch;
typedef struct { uint32_t seq; uint8_t type, length, data[65]; } packet;

static void output(int pin, int value) {
    ESP_ERROR_CHECK(gpio_set_level(pin, value));
    ESP_ERROR_CHECK(gpio_set_direction(pin, GPIO_MODE_OUTPUT));
}
static void cfg_bit(int bit) {
    gpio_set_level(CFG_MOSI, bit);
    esp_rom_delay_us(1);
    gpio_set_level(CFG_SCK, 1);
    esp_rom_delay_us(1);
    gpio_set_level(CFG_SCK, 0);
}
static void program_fpga(void) {
    ESP_ERROR_CHECK(muon_fpga_image_size > 1000 ? ESP_OK : ESP_ERR_INVALID_SIZE);
    // SPI slave configuration: hold SS low across CRESET rising, wait 1.2ms,
    // eight clocks with SS high, image with SS low, then 49 trailing clocks.
    output(CFG_SCK, 0); output(CFG_MOSI, 0); output(CFG_CS, 0);
    output(CRESET, 0);
    ESP_ERROR_CHECK(gpio_set_direction(CDONE, GPIO_MODE_INPUT));
    esp_rom_delay_us(10);
    gpio_set_level(CRESET, 1); esp_rom_delay_us(1300);
    gpio_set_level(CFG_CS, 1);
    for (int i = 0; i < 8; ++i) cfg_bit(0);
    gpio_set_level(CFG_CS, 0);
    for (size_t i = 0; i < muon_fpga_image_size; ++i) {
        for (int bit = 7; bit >= 0; --bit) cfg_bit((muon_fpga_image[i] >> bit) & 1);
        if ((i & 4095) == 4095) vTaskDelay(1);
    }
    gpio_set_level(CFG_CS, 1);
    for (int i = 0; i < 64; ++i) cfg_bit(0);
    ESP_ERROR_CHECK(gpio_get_level(CDONE) ? ESP_OK : ESP_FAIL);
}
static void exchange(uint8_t command, uint8_t *rx, size_t n) {
    uint8_t tx[65] = {0}; tx[0] = command;
    spi_transaction_t t = {.length=n*8, .tx_buffer=tx, .rx_buffer=rx};
    // Manual CS enforces setup/hold even across differing acquisition clocks.
    gpio_set_level(SPI_CS, 0); esp_rom_delay_us(1);
    esp_err_t err = spi_device_polling_transmit(fpga, &t);
    esp_rom_delay_us(1); gpio_set_level(SPI_CS, 1); esp_rom_delay_us(1);
    ESP_ERROR_CHECK(err);
}
static void queue_packet(uint8_t type, const uint8_t *data, int length, uint32_t seq) {
    packet p = {.seq=seq, .type=type, .length=length};
    memcpy(p.data, data, length);
    if (xQueueSend(packets, &p, 0) != pdPASS) atomic_fetch_add(&software_drops, 1);
}
static void acquire(void *unused) {
    (void)unused;
    uint32_t sequence = 0;
    int64_t next_status = 0;
    for (;;) {
        // Bounded batches yield to housekeeping even under continuous noise.
        for (int n = 0; n < 64 && gpio_get_level(IRQ); ++n) {
            uint8_t rx[26]; exchange(MUON_READ_EVENT, rx, sizeof(rx));
            muon_event event;
            if (muon_decode_event(rx, sizeof(rx), &event))
                queue_packet(1, rx, sizeof(rx), sequence++);
        }
        if (esp_timer_get_time() >= next_status) {
            uint8_t rx[65]; exchange(MUON_READ_STATUS, rx, sizeof(rx));
            muon_status status;
            ESP_ERROR_CHECK(muon_decode_status(rx, sizeof(rx), &status) ? ESP_OK : ESP_FAIL);
            queue_packet(2, rx, sizeof(rx), sequence++);
            next_status = esp_timer_get_time() + 1000000;
        }
        vTaskDelay(1);
    }
}
static void wifi_event(void *arg, esp_event_base_t base, int32_t id, void *data) {
    (void)arg; (void)data;
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) esp_wifi_connect();
    else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        atomic_store(&wifi_ready, false); esp_wifi_connect();
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) atomic_store(&wifi_ready, true);
}
static void start_wifi(void) {
#ifndef CONFIG_MUON_POWER_BUDGET_VERIFIED
    return;
#endif
    if (!strlen(CONFIG_MUON_WIFI_SSID)) return;
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();
    wifi_init_config_t init = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&init));
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, wifi_event, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, wifi_event, NULL));
    wifi_config_t cfg = {0};
    snprintf((char *)cfg.sta.ssid, sizeof(cfg.sta.ssid), "%s", CONFIG_MUON_WIFI_SSID);
    snprintf((char *)cfg.sta.password, sizeof(cfg.sta.password), "%s", CONFIG_MUON_WIFI_PASSWORD);
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &cfg));
    ESP_ERROR_CHECK(esp_wifi_start());
}
static void stream(void *unused) {
    (void)unused;
    int sock = -1;
    struct sockaddr_in destination = {.sin_family=AF_INET, .sin_port=htons(CONFIG_MUON_UDP_PORT)};
    if (strlen(CONFIG_MUON_UDP_HOST) && inet_pton(AF_INET, CONFIG_MUON_UDP_HOST, &destination.sin_addr) == 1) {
        sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
        if (sock >= 0) {
            struct timeval timeout = {.tv_usec=10000};
            setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout));
        }
    }
    packet p;
    for (;;) {
        if (xQueueReceive(packets, &p, portMAX_DELAY) != pdPASS) continue;
        char hex[131], line[400];
        for (int i = 0; i < p.length; ++i) snprintf(hex + i*2, 3, "%02x", p.data[i]);
        int count = snprintf(line, sizeof(line),
            "{\"v\":1,\"epoch\":%"PRIu32",\"seq\":%"PRIu32",\"type\":%u,\"spi_hex\":\"%s\",\"software_drops\":%lu,\"udp_errors\":%lu,\"bias_enabled\":false}\n",
            epoch, p.seq, p.type, hex, (unsigned long)atomic_load(&software_drops), (unsigned long)atomic_load(&udp_errors));
        if (sock >= 0 && atomic_load(&wifi_ready)) {
            if (sendto(sock, line, count, 0, (struct sockaddr *)&destination, sizeof(destination)) != count)
                atomic_fetch_add(&udp_errors, 1);
        }
        // USB may stall this low-priority consumer, never the acquisition task.
        fwrite(line, 1, count, stdout); fflush(stdout);
    }
}
void app_main(void) {
    output(HV_EN, 0); output(INJ, 0); output(ACQ_RESET, 1); output(MUX_RESET, 0);
    output(SPI_CS, 1);
    ESP_ERROR_CHECK(gpio_set_direction(IRQ, GPIO_MODE_INPUT));
    ESP_ERROR_CHECK(nvs_flash_init());
    program_fpga();
    spi_bus_config_t bus = {.mosi_io_num=SPI_MOSI, .miso_io_num=SPI_MISO,
        .sclk_io_num=SPI_SCK, .quadwp_io_num=-1, .quadhd_io_num=-1, .max_transfer_sz=65};
    ESP_ERROR_CHECK(spi_bus_initialize(SPI2_HOST, &bus, SPI_DMA_DISABLED));
    spi_device_interface_config_t device = {.clock_speed_hz=1000000, .mode=0, .spics_io_num=-1, .queue_size=1};
    ESP_ERROR_CHECK(spi_bus_add_device(SPI2_HOST, &device, &fpga));
    gpio_set_level(ACQ_RESET, 0); esp_rom_delay_us(10);
    uint8_t rx[65]; exchange(MUON_READ_STATUS, rx, sizeof(rx));
    muon_status status;
    ESP_ERROR_CHECK(muon_decode_status(rx, sizeof(rx), &status) ? ESP_OK : ESP_FAIL);
    exchange(MUON_RESET, rx, 2);
    ESP_ERROR_CHECK(rx[1] == 0xac ? ESP_OK : ESP_FAIL);
    epoch = (uint32_t)esp_timer_get_time();
    packets = xQueueCreate(128, sizeof(packet));
    ESP_ERROR_CHECK(packets ? ESP_OK : ESP_ERR_NO_MEM);
    start_wifi();
    xTaskCreatePinnedToCore(acquire, "capture", 4096, NULL, 12, NULL, 1);
    xTaskCreatePinnedToCore(stream, "stream", 4096, NULL, 4, NULL, 0);
}
