cmake_minimum_required(VERSION 3.24)
project(DodgeCathedraleNative LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
find_package(SDL3 CONFIG REQUIRED)
find_package(SDL3_image CONFIG REQUIRED)
add_executable(DodgeCathedrale src/main.cpp)
target_link_libraries(DodgeCathedrale PRIVATE SDL3::SDL3 SDL3_image::SDL3_image)
add_custom_command(TARGET DodgeCathedrale POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_directory
  ${CMAKE_CURRENT_SOURCE_DIR}/../assets
  $<TARGET_FILE_DIR:DodgeCathedrale>/assets
)
if(MSVC)
  target_compile_options(DodgeCathedrale PRIVATE /W4 /permissive-)
else()
  target_compile_options(DodgeCathedrale PRIVATE -Wall -Wextra -Wpedantic)
endif()
