import { useMemo, useState } from 'react';
import {
  Activity,
  Apple,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Target,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { weeklyCalories } from './data/mock';
import { useNutritionStore } from './store/useNutritionStore';
import type { FoodEntry, MealType } from './types';
import { ProgressCard } from './components/ProgressCard';
import './styles.css';

const nav = [
  ['今日概览', LayoutDashboard],
  ['饮食记录', Apple],
  ['食物库', BookOpen],
  ['身体数据', Activity],
  ['数据分析', BarChart3],
  ['目标设置', Target],
] as const;

const meals: MealType[] = ['早餐', '午餐', '晚餐', '加餐'];

const numberFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 });

function todayLabel() {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const { foods, goal, trainingDay, toggleTrainingDay, removeFood, addFood } = useNutritionStore();
  const [active, setActive] = useState('今日概览');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealType>('早餐');
  const [formError, setFormError] = useState('');

  const totals = useMemo(
    () =>
      foods.reduce(
        (total, food) => ({
          calories: total.calories + food.calories,
          protein: total.protein + food.protein,
          carbs: total.carbs + food.carbs,
          fat: total.fat + food.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [foods],
  );

  const caloriePercent = goal.calories > 0 ? Math.round((totals.calories / goal.calories) * 100) : 0;

  function openFoodModal(meal: MealType = '早餐') {
    setSelectedMeal(meal);
    setFormError('');
    setModalOpen(true);
  }

  function submitFood(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const numeric = (name: string) => Number(form.get(name));
    const entry: FoodEntry = {
      id: createId(),
      name: String(form.get('name') ?? '').trim(),
      meal: String(form.get('meal')) as MealType,
      amount: numeric('amount'),
      unit: String(form.get('unit') ?? '').trim() || 'g',
      calories: numeric('calories'),
      protein: numeric('protein'),
      carbs: numeric('carbs'),
      fat: numeric('fat'),
    };

    const values = [entry.amount, entry.calories, entry.protein, entry.carbs, entry.fat];
    if (!entry.name) {
      setFormError('请输入食物名称。');
      return;
    }
    if (values.some((value) => !Number.isFinite(value) || value < 0) || entry.amount <= 0) {
      setFormError('数量必须大于 0，营养数据不能为负数。');
      return;
    }

    addFood(entry);
    setModalOpen(false);
    event.currentTarget.reset();
  }

  function addPostWorkoutSnack() {
    addFood({
      id: createId(),
      name: '蛋白粉 + 香蕉',
      meal: '加餐',
      amount: 1,
      unit: '份',
      calories: 225,
      protein: 26,
      carbs: 29,
      fat: 2,
    });
  }

  return (
    <div className="app-shell">
      <aside>
        <div className="brand">
          <div className="brand-mark"><Dumbbell size={22} /></div>
          <div><strong>FuelLog</strong><span>训练营养助手</span></div>
        </div>
        <nav>
          {nav.map(([label, Icon]) => (
            <button key={label} className={active === label ? 'active' : ''} onClick={() => setActive(label)}>
              <Icon size={18} />{label}
            </button>
          ))}
        </nav>
        <div className="profile">
          <div className="avatar"><UserRound size={20} /></div>
          <div><strong>健身达人</strong><span>增肌计划</span></div>
          <Settings size={17} />
        </div>
      </aside>

      <main>
        <header>
          <div><p className="eyebrow">{todayLabel()}</p><h1>今天继续稳步完成营养目标。</h1></div>
          <div className="header-actions">
            <button className="day-toggle" onClick={toggleTrainingDay}><Dumbbell size={17} />{trainingDay ? '训练日' : '休息日'}</button>
            <button className="primary" onClick={() => openFoodModal()}><Plus size={18} />记录饮食</button>
          </div>
        </header>

        <section className="hero">
          <div>
            <span>今日热量</span>
            <strong>{numberFormat.format(totals.calories)} <small>/ {goal.calories} kcal</small></strong>
            <p>{totals.calories <= goal.calories ? `还可摄入 ${numberFormat.format(goal.calories - totals.calories)} kcal` : `已超出 ${numberFormat.format(totals.calories - goal.calories)} kcal`}</p>
          </div>
          <div className="hero-ring" style={{ '--progress': `${Math.min(100, Math.max(0, caloriePercent)) * 3.6}deg` } as React.CSSProperties}>
            <span>{caloriePercent}%</span>
          </div>
        </section>

        <section className="macro-grid">
          <ProgressCard label="蛋白质" value={totals.protein} target={goal.protein} unit="g" />
          <ProgressCard label="碳水化合物" value={totals.carbs} target={goal.carbs} unit="g" />
          <ProgressCard label="脂肪" value={totals.fat} target={goal.fat} unit="g" />
        </section>

        <div className="content-grid">
          <section className="panel meals-panel">
            <div className="panel-title">
              <div><p className="eyebrow">今天的记录</p><h2>饮食明细</h2></div>
              <button className="ghost" onClick={() => openFoodModal()}><Search size={17} />添加食物</button>
            </div>
            {meals.map((meal) => {
              const mealFoods = foods.filter((food) => food.meal === meal);
              return (
                <div className="meal" key={meal}>
                  <div className="meal-head">
                    <div><span className="meal-icon"><Apple size={16} /></span><strong>{meal}</strong></div>
                    <span>{numberFormat.format(mealFoods.reduce((sum, food) => sum + food.calories, 0))} kcal</span>
                  </div>
                  {mealFoods.length === 0 ? (
                    <button className="empty-add" onClick={() => openFoodModal(meal)}><Plus size={16} />添加{meal}</button>
                  ) : mealFoods.map((food) => (
                    <div className="food-row" key={food.id}>
                      <div><strong>{food.name}</strong><span>{numberFormat.format(food.amount)}{food.unit} · 蛋白质 {numberFormat.format(food.protein)}g</span></div>
                      <div><strong>{numberFormat.format(food.calories)} kcal</strong><button aria-label={`删除${food.name}`} onClick={() => removeFood(food.id)}><Trash2 size={15} /></button></div>
                    </div>
                  ))}
                </div>
              );
            })}
          </section>

          <aside className="right-column">
            <section className="panel">
              <div className="panel-title compact"><div><p className="eyebrow">最近 7 天</p><h2>热量趋势</h2></div><ChevronRight size={18} /></div>
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyCalories}>
                    <defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="currentColor" stopOpacity={0.28} /><stop offset="95%" stopColor="currentColor" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} />
                    <YAxis hide domain={[0, 2600]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="currentColor" fill="url(#fill)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="panel quick-panel">
              <div className="panel-title compact"><div><p className="eyebrow">效率工具</p><h2>快捷操作</h2></div></div>
              <button onClick={() => openFoodModal()}><CalendarDays size={18} /><span><strong>手动添加饮食</strong><small>录入任意食物营养数据</small></span><ChevronRight size={17} /></button>
              <button onClick={addPostWorkoutSnack}><Dumbbell size={18} /><span><strong>训练后加餐</strong><small>蛋白粉 + 香蕉</small></span><ChevronRight size={17} /></button>
              <button onClick={() => openFoodModal('加餐')}><Apple size={18} /><span><strong>添加自定义加餐</strong><small>快速补充当日营养</small></span><ChevronRight size={17} /></button>
            </section>
          </aside>
        </div>
      </main>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
          <section className="food-modal" role="dialog" aria-modal="true" aria-labelledby="food-modal-title">
            <div className="modal-header">
              <div><p className="eyebrow">新增记录</p><h2 id="food-modal-title">记录饮食</h2></div>
              <button className="icon-button" aria-label="关闭" onClick={() => setModalOpen(false)}><X size={19} /></button>
            </div>
            <form onSubmit={submitFood}>
              <label>食物名称<input name="name" autoFocus placeholder="例如：鸡胸肉" /></label>
              <div className="form-grid">
                <label>餐次<select name="meal" value={selectedMeal} onChange={(event) => setSelectedMeal(event.target.value as MealType)}>{meals.map((meal) => <option key={meal}>{meal}</option>)}</select></label>
                <label>数量<input name="amount" type="number" min="0.1" step="0.1" defaultValue="100" /></label>
                <label>单位<input name="unit" defaultValue="g" /></label>
                <label>热量 kcal<input name="calories" type="number" min="0" step="0.1" defaultValue="0" /></label>
                <label>蛋白质 g<input name="protein" type="number" min="0" step="0.1" defaultValue="0" /></label>
                <label>碳水 g<input name="carbs" type="number" min="0" step="0.1" defaultValue="0" /></label>
                <label>脂肪 g<input name="fat" type="number" min="0" step="0.1" defaultValue="0" /></label>
              </div>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="modal-actions"><button type="button" className="ghost" onClick={() => setModalOpen(false)}>取消</button><button type="submit" className="primary">保存记录</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
