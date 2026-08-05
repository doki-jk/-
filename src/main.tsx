import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GoalSettings } from './components/GoalSettings';
import { isTauriRuntime } from './database/client';
import { initializeDatabase } from './database/migrations';
import { seedDatabase } from './database/seed';
import { useNutritionStore } from './store/useNutritionStore';

async function bootstrap(): Promise<void> {
  if (isTauriRuntime()) {
    try {
      await initializeDatabase();
      await seedDatabase();
      await Promise.all([
        useNutritionStore.getState().loadToday(),
        useNutritionStore.getState().loadGoal(),
      ]);
    } catch (error) {
      console.error('FuelLog 数据库初始化失败', error);
    }
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
      <GoalSettings />
    </React.StrictMode>
  );
}

void bootstrap();
