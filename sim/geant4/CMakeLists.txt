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

set(SOURCES
  muon_panel.cc
  src/PanelDetectorConstruction.cc
  src/PanelPrimaryGeneratorAction.cc
  src/PanelPhysicsList.cc
  src/PanelEventAction.cc
  src/PanelRunAction.cc
  src/PanelSteppingAction.cc
  src/PanelSensitiveDetector.cc
  src/PanelActionInitialization.cc
)

set(HEADERS
  include/PanelDetectorConstruction.hh
  include/PanelPrimaryGeneratorAction.hh
  include/PanelPhysicsList.hh
  include/PanelEventAction.hh
  include/PanelRunAction.hh
  include/PanelSteppingAction.hh
  include/PanelSensitiveDetector.hh
  include/PanelActionInitialization.hh
)

add_executable(muon_panel ${SOURCES} ${HEADERS})

target_include_directories(muon_panel PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/include
  ${Geant4_INCLUDE_DIRS}
)

target_link_libraries(muon_panel ${Geant4_LIBRARIES})

if(WITH_ROOT)
  target_link_libraries(muon_panel ROOT::Core ROOT::Tree)
endif()

# Copy macros to build dir for convenience
file(COPY macros DESTINATION ${CMAKE_CURRENT_BINARY_DIR})

install(TARGETS muon_panel DESTINATION bin)
