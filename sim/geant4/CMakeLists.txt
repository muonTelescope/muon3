cmake_minimum_required(VERSION 3.16)
project(muon_panel LANGUAGES CXX)

# Geant4 (required)
find_package(Geant4 REQUIRED ui_all vis_all)

# Optional ROOT support for ntuples
option(WITH_ROOT "Build with ROOT analysis" OFF)
if(WITH_ROOT)
  find_package(ROOT REQUIRED)
  add_definitions(-DWITH_ROOT)
endif()

include(${Geant4_USE_FILE})

set(COMMON_SOURCES
  src/PanelDetectorConstruction.cc
  src/PanelPrimaryGeneratorAction.cc
  src/PanelPhysicsList.cc
  src/PanelEventAction.cc
  src/PanelRunAction.cc
  src/PanelSteppingAction.cc
  src/PanelSensitiveDetector.cc
  src/PanelActionInitialization.cc
  src/HcalTileDetectorConstruction.cc
  src/HcalTilePrimaryGeneratorAction.cc
  src/HcalTileActionInitialization.cc
)

set(COMMON_HEADERS
  include/PanelDetectorConstruction.hh
  include/PanelPrimaryGeneratorAction.hh
  include/PanelPhysicsList.hh
  include/PanelEventAction.hh
  include/PanelRunAction.hh
  include/PanelSteppingAction.hh
  include/PanelSensitiveDetector.hh
  include/PanelActionInitialization.hh
  include/HcalTileDetectorConstruction.hh
  include/HcalTilePrimaryGeneratorAction.hh
  include/HcalTileActionInitialization.hh
)

add_executable(muon_panel muon_panel.cc ${COMMON_SOURCES} ${COMMON_HEADERS})
add_executable(hcal_tile hcal_tile.cc ${COMMON_SOURCES} ${COMMON_HEADERS})

foreach(tgt muon_panel hcal_tile)
  target_include_directories(${tgt} PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${Geant4_INCLUDE_DIRS}
  )
  target_link_libraries(${tgt} ${Geant4_LIBRARIES})
  if(WITH_ROOT)
    target_link_libraries(${tgt} ROOT::Core ROOT::Tree)
  endif()
endforeach()

# Copy macros and assembly GDMLs into the build tree
file(COPY macros DESTINATION ${CMAKE_CURRENT_BINARY_DIR})
if(EXISTS ${CMAKE_CURRENT_SOURCE_DIR}/gdml)
  file(COPY gdml DESTINATION ${CMAKE_CURRENT_BINARY_DIR})
endif()

install(TARGETS muon_panel hcal_tile DESTINATION bin)
