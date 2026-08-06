import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { isTauriRuntime } from './database/client';
import { initializeDatabase } from './database/migrations';
import { seedDatabase } from './database/seed';
import { useNutritionStore } from './store/useNutritionStore';
import './hardening.css';

async function bootstrap(): Promise<void> {
  try {
    if (isTauriRuntime()) {
      await initializeDatabase();
      await seedDatabase();
    }

    const state = useNutritionStore.getState();
    await state.loadDate(state.selectedDate);
  } catch (error) {
    console.error('FuelLog 初始化失败', error);
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
