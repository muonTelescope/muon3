set(bitstream "${CMAKE_CURRENT_LIST_DIR}/../../gateware/build/muon3.bin")
if(MUON_COMPILE_ONLY)
    message(WARNING "COMPILE-ONLY: invalid placeholder FPGA image, not runnable firmware")
    set(fpga_hex "00")
elseif(NOT EXISTS "${bitstream}")
    message(FATAL_ERROR "Build and pass timing for hw/gateware first; no FPGA bitstream found")
else()
    file(READ "${bitstream}" fpga_hex HEX)
endif()
string(REGEX REPLACE "(..)" "0x\\1," fpga_bytes "${fpga_hex}")
file(WRITE "${CMAKE_CURRENT_BINARY_DIR}/fpga_image.c"
    "#include <stddef.h>\nconst unsigned char muon_fpga_image[] = {${fpga_bytes}};\nconst size_t muon_fpga_image_size = sizeof(muon_fpga_image);\n")
idf_component_register(SRCS "main.c" "${CMAKE_CURRENT_BINARY_DIR}/fpga_image.c"
    INCLUDE_DIRS "." "../interface"
    REQUIRES driver esp_wifi esp_event esp_netif nvs_flash esp_timer)
