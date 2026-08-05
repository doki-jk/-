# Architecture

## Frontend

- `src/App.tsx`: desktop dashboard shell
- `src/store`: Zustand application state
- `src/types`: domain types
- `src/data`: initial mock data
- `src/components`: reusable UI components

## Desktop layer

- `src-tauri`: Tauri 2 shell
- `tauri-plugin-sql`: planned SQLite persistence layer

## Planned database tables

- `foods`
- `food_entries`
- `daily_goals`
- `body_measurements`
- `user_settings`
