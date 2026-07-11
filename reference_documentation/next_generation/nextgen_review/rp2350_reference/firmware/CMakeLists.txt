cmake_minimum_required(VERSION 3.13)

include(pico_sdk_import.cmake)

project(muon_telescope C CXX ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

pico_sdk_init()

add_executable(muon_telescope
  src/main.c
  src/proto.c
  src/bme280.c
  src/dac7578.c
)

pico_generate_pio_header(muon_telescope ${CMAKE_CURRENT_LIST_DIR}/pio/edge_fall.pio)

target_include_directories(muon_telescope PRIVATE
  ${CMAKE_CURRENT_LIST_DIR}/src
  ${CMAKE_CURRENT_BINARY_DIR}
)

target_link_libraries(muon_telescope
  pico_stdlib
  hardware_pio
  hardware_i2c
  hardware_irq
  hardware_timer
  pico_multicore
  tinyusb_device
  tinyusb_board
)

pico_enable_stdio_usb(muon_telescope 0)  # we use TinyUSB CDC directly
pico_enable_stdio_uart(muon_telescope 0)

pico_add_extra_outputs(muon_telescope)
