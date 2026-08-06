import { useEffect, useState } from 'react';
import {
  Activity,
  Apple,
  BarChart3,
  BookOpen,
  DatabaseBackup,
  Dumbbell,
  LayoutDashboard,
  RotateCcw,
  Settings,
  Target,
  UserRound,
} from 'lucide-react';
import { BodyData } from './components/BodyData';
import { DashboardPage } from './components/DashboardPage';
import { DataAnalysis } from './components/DataAnalysis';
import { DataManagement } from './components/DataManagement';
import { FoodEntryModal } from './components/FoodEntryModal';
import { FoodLibrary } from './components/FoodLibrary';
import { GoalSettings } from './components/GoalSettings';
import { MealRecords } from './components/MealRecords';
import { analyticsRepository } from './repositories/analyticsRepository';
import type { Food } from './repositories/foodRepository';
import { useNutritionStore } from './store/useNutritionStore';
import type { FoodEntry, MealType } from './types';
import { localDateKey } from './utils/date';
import './styles.css';
import './responsive.css';

const nav = [
  ['今日概览', LayoutDashboard],
  ['饮食记录', Apple],
  ['食物库', BookOpen],
  ['身体数据', Activity],
  ['数据分析', BarChart3],
  ['目标设置', Target],
  ['数据管理', DatabaseBackup],
] as const;

type PageName = (typeof nav)[number][0];

function suggestedMeal(date = new Date()): MealType {
  const hour = date.getHours();
  if (hour < 10) return '早餐';
  if (hour < 15) return '午餐';
  if (hour < 21) return '晚餐';
  return '加餐';
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

export default function App() {
  const { selectedDate, removeFood, addFood, updateFood } = useNutritionStore();
  const [active, setActive] = useState<PageName>('今日概览');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealType>(suggestedMeal());
  const [sourceFood, setSourceFood] = useState<Food | null>(null);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [undoEntry, setUndoEntry] = useState<FoodEntry | null>(null);
  const [chartData, setChartData] = useState<Array<{ day: string; value: number }>>([]);

  const recordLabel = selectedDate === localDateKey() ? '今天' : dateLabel(selectedDate);

  async function refreshAnalytics() {
    try {
      const points = await analyticsRepository.getLastSevenDays();
      const formatter = new Intl.DateTimeFormat('zh-CN', { weekday: 'short' });
      setChartData(points.map((point) => ({
        day: formatter.format(new Date(`${point.date}T12:00:00`)),
        value: point.calories,
      })));
    } catch (analyticsError) {
      console.error('读取营养趋势失败', analyticsError);
    }
  }

  useEffect(() => {
    void refreshAnalytics();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => {
      setNotice('');
      setUndoEntry(null);
    }, undoEntry ? 8000 : 3600);
    return () => window.clearTimeout(timer);
  }, [notice, undoEntry]);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) closeFoodModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, saving]);

  function openFoodModal(meal: MealType = suggestedMeal(), food: Food | null = null) {
    setSelectedMeal(meal);
    setSourceFood(food);
    setEditingEntry(null);
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(entry: FoodEntry) {
    setSelectedMeal(entry.meal);
    setSourceFood(null);
    setEditingEntry(entry);
    setFormError('');
    setModalOpen(true);
  }

  function closeFoodModal() {
    setModalOpen(false);
    setSourceFood(null);
    setEditingEntry(null);
    setFormError('');
  }

  async function submitFood(entry: FoodEntry) {
    setSaving(true);
    setFormError('');
    try {
      if (editingEntry) {
        await updateFood(editingEntry.id, entry);
        setNotice(`已更新“${entry.name}”。`);
      } else {
        await addFood(entry);
        setNotice(`已将“${entry.name}”记录到${recordLabel}。`);
      }
      setUndoEntry(null);
      await refreshAnalytics();
      closeFoodModal();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : '保存失败，请重试。');
    } finally {
      setSaving(false);
    }
  }

  async function deleteFood(entry: FoodEntry) {
    if (!window.confirm(`确定删除“${entry.name}”吗？删除后可在 8 秒内撤销。`)) return;
    try {
      const removed = await removeFood(entry.id);
      await refreshAnalytics();
      setUndoEntry(removed);
      setNotice(`已删除“${removed.name}”。`);
    } catch {
      // Store displays the detailed error.
    }
  }

  async function undoDelete() {
    if (!undoEntry) return;
    try {
      await addFood(undoEntry);
      await refreshAnalytics();
      setNotice(`已恢复“${undoEntry.name}”。`);
      setUndoEntry(null);
    } catch {
      // Store displays the detailed error.
    }
  }

  async function addPostWorkoutSnack() {
    try {
      await addFood({
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
        name: '蛋白粉 + 香蕉',
        meal: '加餐',
        amount: 1,
        unit: '份',
        calories: 225,
        protein: 26,
        carbs: 29,
        fat: 2,
      });
      await refreshAnalytics();
      setNotice('训练后加餐已记录。');
    } catch {
      // Store displays the detailed error.
    }
  }

  let page: React.ReactNode;
  switch (active) {
    case '目标设置':
      page = <GoalSettings />;
      break;
    case '身体数据':
      page = <BodyData />;
      break;
    case '数据分析':
      page = <DataAnalysis />;
      break;
    case '数据管理':
      page = <DataManagement />;
      break;
    case '食物库':
      page = <FoodLibrary onRecordFood={(food) => openFoodModal(suggestedMeal(), food)} />;
      break;
    case '饮食记录':
      page = (
        <MealRecords
          onAddFood={openFoodModal}
          onEditFood={openEditModal}
          onDeleteFood={(entry) => void deleteFood(entry)}
        />
      );
      break;
    default:
      page = (
        <DashboardPage
          chartData={chartData}
          saving={saving}
          onAddFood={openFoodModal}
          onEditFood={openEditModal}
          onDeleteFood={(entry) => void deleteFood(entry)}
          onAddPostWorkoutSnack={() => void addPostWorkoutSnack()}
        />
      );
  }

  return (
    <div className="app-shell">
      <aside>
        <div className="brand">
          <div className="brand-mark"><Dumbbell size={22} /></div>
          <div><strong>FuelLog</strong><span>训练营养助手</span></div>
        </div>
        <nav aria-label="主导航">
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={active === label ? 'active' : ''}
              aria-current={active === label ? 'page' : undefined}
              onClick={() => {
                setActive(label);
                closeFoodModal();
              }}
            >
              <Icon size={18} />{label}
            </button>
          ))}
        </nav>
        <button className="profile" type="button" onClick={() => setActive('数据管理')}>
          <div className="avatar"><UserRound size={20} /></div>
          <div><strong>健身达人</strong><span>数据保存在当前设备</span></div>
          <Settings size={17} />
        </button>
      </aside>

      <main>{page}</main>

      {notice && (
        <div className="app-toast" role="status">
          <span>{notice}</span>
          {undoEntry && <button type="button" onClick={() => void undoDelete()}><RotateCcw size={15} />撤销</button>}
        </div>
      )}

      <FoodEntryModal
        open={modalOpen}
        recordLabel={recordLabel}
        selectedMeal={selectedMeal}
        sourceFood={sourceFood}
        editingEntry={editingEntry}
        saving={saving}
        externalError={formError}
        onClose={closeFoodModal}
        onMealChange={setSelectedMeal}
        onSubmit={submitFood}
      />
    </div>
  );
}
