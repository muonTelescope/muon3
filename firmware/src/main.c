/*
 * Copyright (c) 2026
 * SPDX-License-Identifier: Apache-2.0
 */

#include <zephyr/kernel.h>
#include <zephyr/drivers/spi.h>
#include <zephyr/drivers/i2c.h>
#include <zephyr/logging/log.h>

LOG_MODULE_REGISTER(muon3, LOG_LEVEL_INF);

#define SPI_DEV_NODE DT_NODELABEL(spi2)  /* match your board overlay */
#define I2C_DEV_NODE DT_NODELABEL(i2c2)

static const struct device *spi_dev = DEVICE_DT_GET(SPI_DEV_NODE);
static const struct device *i2c_dev = DEVICE_DT_GET(I2C_DEV_NODE);

int main(void)
{
	LOG_INF("Muon3 firmware starting on nRF9151 (Zephyr modern)");

	if (!device_is_ready(spi_dev)) {
		LOG_ERR("SPI device not ready");
		return 0;
	}
	if (!device_is_ready(i2c_dev)) {
		LOG_ERR("I2C device not ready");
		return 0;
	}

	/* TODO:
	 * - Init nRF modem (AT commands or lte lc)
	 * - SPI comms with iCE40 gateware (read events, timestamps, control)
	 * - Read BME280 for temp/humidity/pressure, compute dew point
	 * - Control 4x TEC drivers (DRV8873) + fans via GPIO/PWM
	 * - GNSS + PPS sync
	 * - Cellular telemetry (MQTT/CoAP/UDP to server)
	 * - Config via SPI or cloud
	 * - Calibration injection
	 */

	while (1) {
		k_sleep(K_SECONDS(5));
		LOG_INF("Muon3 alive");
	}
	return 0;
}
