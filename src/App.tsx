import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Apple,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  DatabaseBackup,
  Dumbbell,
  LayoutDashboard,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Target,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BodyData } from './components/BodyData';
import { DataAnalysis } from './components/DataAnalysis';
import { DataManagement } from './components/DataManagement';
import { FoodEntryModal } from './components/FoodEntryModal';
import { FoodLibrary } from './components/FoodLibrary';
import { GoalSettings } from './components/GoalSettings';
import { MealRecords } from './components/MealRecords';
import { ProgressCard } from './components/ProgressCard';
import { analyticsRepository } from './repositories/analyticsRepository';
import type { Food } from './repositories/foodRepository';
import { useNutritionStore } from './store/useNutritionStore';
import type { FoodEntry, MealType } from './types';
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
const meals: MealType[] = ['早餐', '午餐', '晚餐', '加餐'];
const numberFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 });

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(`${date}T12:00:00`));
}

function suggestedMeal(date = new Date()): MealType {
  const hour = date.getHours();
  if (hour < 10) return '早餐';
  if (hour < 15) return '午餐';
  if (hour < 21) return '晚餐';
  return '加餐';
}

export default function App() {
  const {
    foods,
    goal,
    trainingDay,
    selectedDate,
    loading,
    toggleTrainingDay,
    loadDate,
    removeFood,
    addFood,
    updateFood,
    error,
  } = useNutritionStore();
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

  const isToday = selectedDate === localDateKey();
  const recordLabel = isToday ? '今天' : dateLabel(selectedDate).replace(/星期.*/, '').trim();

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

  const totals = useMemo(() => foods.reduce((total, food) => ({
    calories: total.calories + food.calories,
    protein: total.protein + food.protein,
    carbs: total.carbs + food.carbs,
    fat: total.fat + food.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [foods]);

  const caloriePercent = goal.calories > 0 ? Math.round((totals.calories / goal.calories) * 100) : 0;

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

      <main>
        {active === '目标设置'
          ? <GoalSettings />
          : active === '身体数据'
            ? <BodyData />
            : active === '数据分析'
              ? <DataAnalysis />
              : active === '数据管理'
                ? <DataManagement />
                : active === '食物库'
                  ? <FoodLibrary onRecordFood={(food) => openFoodModal(suggestedMeal(), food)} />
                  : active === '饮食记录'
                    ? <MealRecords onAddFood={openFoodModal} onEditFood={openEditModal} onDeleteFood={(entry) => void deleteFood(entry)} />
                    : (
                      <>
                        <header>
                          <div>
                            <p className="eyebrow">{dateLabel(selectedDate)}</p>
                            <h1>{isToday ? '今天继续稳步完成营养目标。' : `查看 ${recordLabel} 的饮食记录。`}</h1>
                          </div>
                          <div className="header-actions">
                            <label className="date-picker" aria-label="选择记录日期">
                              <CalendarDays size={17} />
                              <input type="date" value={selectedDate} disabled={loading || saving} onChange={(event) => void loadDate(event.target.value)} />
                            </label>
                            {!isToday && <button className="ghost" disabled={loading || saving} onClick={() => void loadDate(localDateKey())}>返回今天</button>}
                            <button className="day-toggle" disabled={loading || saving} onClick={() => void toggleTrainingDay()}><Dumbbell size={17} />{trainingDay ? '训练日' : '休息日'}</button>
                            <button className="primary" disabled={loading || saving} onClick={() => openFoodModal()}><Plus size={18} />记录饮食</button>
                          </div>
                        </header>

                        {error && <p className="form-error" role="alert">数据操作失败：{error}</p>}
                        {loading && <p className="data-status" role="status">正在读取 {recordLabel} 的饮食记录…</p>}

                        <section className="hero">
                          <div>
                            <span>{recordLabel}热量</span>
                            <strong>{numberFormat.format(totals.calories)} <small>/ {goal.calories} kcal</small></strong>
                            <p>{totals.calories <= goal.calories ? `还可摄入 ${numberFormat.format(goal.calories - totals.calories)} kcal` : `已超出 ${numberFormat.format(totals.calories - goal.calories)} kcal`}</p>
                          </div>
                          <div className="hero-ring" style={{ '--progress': `${Math.min(100, Math.max(0, caloriePercent)) * 3.6}deg` } as React.CSSProperties}><span>{caloriePercent}%</span></div>
                        </section>

                        <section className="macro-grid">
                          <ProgressCard label="蛋白质" value={totals.protein} target={goal.protein} unit="g" />
                          <ProgressCard label="碳水化合物" value={totals.carbs} target={goal.carbs} unit="g" />
                          <ProgressCard label="脂肪" value={totals.fat} target={goal.fat} unit="g" />
                        </section>

                        <div className="content-grid">
                          <section className="panel meals-panel">
                            <div className="panel-title">
                              <div><p className="eyebrow">{recordLabel}的记录</p><h2>饮食明细</h2></div>
                              <button className="ghost" disabled={loading || saving} onClick={() => openFoodModal()}><Search size={17} />添加食物</button>
                            </div>
                            {meals.map((meal) => {
                              const mealFoods = foods.filter((food) => food.meal === meal);
                              return (
                                <div className="meal" key={meal}>
                                  <div className="meal-head">
                                    <div><span className="meal-icon"><Apple size={16} /></span><strong>{meal}</strong></div>
                                    <span>{numberFormat.format(mealFoods.reduce((sum, food) => sum + food.calories, 0))} kcal</span>
                                  </div>
                                  {mealFoods.length === 0
                                    ? <button className="empty-add" disabled={loading || saving} onClick={() => openFoodModal(meal)}><Plus size={16} />添加{meal}</button>
                                    : mealFoods.map((food) => (
                                      <div className="food-row" key={food.id}>
                                        <div><strong>{food.name}</strong><span>{numberFormat.format(food.amount)}{food.unit} · 蛋白质 {numberFormat.format(food.protein)}g</span></div>
                                        <div>
                                          <strong>{numberFormat.format(food.calories)} kcal</strong>
                                          <button aria-label={`编辑${food.name}`} title="编辑" disabled={saving} onClick={() => openEditModal(food)}><Pencil size={15} /></button>
                                          <button aria-label={`删除${food.name}`} title="删除" disabled={saving} onClick={() => void deleteFood(food)}><Trash2 size={15} /></button>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              );
                            })}
                          </section>

                          <aside className="right-column">
                            <section className="panel">
                              <div className="panel-title compact"><div><p className="eyebrow">最近 7 天</p><h2>真实热量趋势</h2></div><ChevronRight size={18} /></div>
                              <div className="chart">
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={chartData}>
                                    <defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="currentColor" stopOpacity={0.28} /><stop offset="95%" stopColor="currentColor" stopOpacity={0} /></linearGradient></defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} />
                                    <YAxis hide domain={[0, 'auto']} />
                                    <Tooltip formatter={(value) => [`${numberFormat.format(Number(value))} kcal`, '热量']} />
                                    <Area type="monotone" dataKey="value" stroke="currentColor" fill="url(#fill)" strokeWidth={3} />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                            </section>
                            <section className="panel quick-panel">
                              <div className="panel-title compact"><div><p className="eyebrow">效率工具</p><h2>快捷操作</h2></div></div>
                              <button onClick={() => openFoodModal()}><CalendarDays size={18} /><span><strong>手动添加饮食</strong><small>记录到当前选择日期</small></span><ChevronRight size={17} /></button>
                              <button disabled={saving} onClick={() => void addPostWorkoutSnack()}><Dumbbell size={18} /><span><strong>训练后加餐</strong><small>蛋白粉 + 香蕉</small></span><ChevronRight size={17} /></button>
                              <button onClick={() => openFoodModal('加餐')}><Apple size={18} /><span><strong>添加自定义加餐</strong><small>快速补充当日营养</small></span><ChevronRight size={17} /></button>
                            </section>
                          </aside>
                        </div>
                      </>
                    )}
      </main>

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
