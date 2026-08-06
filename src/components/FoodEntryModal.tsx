import { Calculator, LockKeyhole, UnlockKeyhole, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Food } from '../repositories/foodRepository';
import { useNutritionStore } from '../store/useNutritionStore';
import type { FoodEntry, MealType } from '../types';
import { localDateFromKey } from '../utils/date';
import { isValidNutrition, scaleNutrition, type NutritionValues } from '../utils/nutrition';

const meals: MealType[] = ['早餐', '午餐', '晚餐', '加餐'];

interface FoodEntryModalProps {
  open: boolean;
  recordLabel: string;
  selectedMeal: MealType;
  sourceFood: Food | null;
  editingEntry: FoodEntry | null;
  saving: boolean;
  externalError: string;
  onClose: () => void;
  onMealChange: (meal: MealType) => void;
  onSubmit: (entry: FoodEntry) => Promise<void>;
}

function emptyNutrition(): NutritionValues {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

function currentTimeValue(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function FoodEntryModal({
  open,
  recordLabel,
  selectedMeal,
  sourceFood,
  editingEntry,
  saving,
  externalError,
  onClose,
  onMealChange,
  onSubmit,
}: FoodEntryModalProps) {
  const selectedDate = useNutritionStore((state) => state.selectedDate);
  const [name, setName] = useState('');
  const [time, setTime] = useState(currentTimeValue());
  const [amount, setAmount] = useState(100);
  const [unit, setUnit] = useState('g');
  const [nutrition, setNutrition] = useState<NutritionValues>(emptyNutrition());
  const [autoCalculate, setAutoCalculate] = useState(false);
  const [formError, setFormError] = useState('');
  const [base, setBase] = useState<{ amount: number; unit: string; nutrition: NutritionValues } | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormError('');
    if (editingEntry) {
      const initialNutrition = {
        calories: editingEntry.calories,
        protein: editingEntry.protein,
        carbs: editingEntry.carbs,
        fat: editingEntry.fat,
      };
      const consumedDate = editingEntry.consumedAt ? new Date(editingEntry.consumedAt) : new Date();
      setName(editingEntry.name);
      setTime(Number.isNaN(consumedDate.getTime()) ? currentTimeValue() : currentTimeValue(consumedDate));
      setAmount(editingEntry.amount);
      setUnit(editingEntry.unit);
      setNutrition(initialNutrition);
      setBase({ amount: editingEntry.amount, unit: editingEntry.unit, nutrition: initialNutrition });
      setAutoCalculate(true);
      return;
    }
    setTime(currentTimeValue());
    if (sourceFood) {
      const initialNutrition = {
        calories: sourceFood.calories,
        protein: sourceFood.protein,
        carbs: sourceFood.carbs,
        fat: sourceFood.fat,
      };
      setName(sourceFood.name);
      setAmount(sourceFood.baseAmount);
      setUnit(sourceFood.baseUnit);
      setNutrition(initialNutrition);
      setBase({ amount: sourceFood.baseAmount, unit: sourceFood.baseUnit, nutrition: initialNutrition });
      setAutoCalculate(true);
      return;
    }
    setName('');
    setAmount(100);
    setUnit('g');
    setNutrition(emptyNutrition());
    setBase(null);
    setAutoCalculate(false);
  }, [open, sourceFood, editingEntry]);

  const scalingAvailable = Boolean(base && unit.trim() === base.unit.trim());
  const scalingHint = useMemo(() => {
    if (!base) return '手动录入模式';
    if (!scalingAvailable) return `单位已从 ${base.unit} 改为 ${unit || '空'}，自动计算已暂停`;
    return `以 ${base.amount}${base.unit} 为基准自动换算`;
  }, [base, scalingAvailable, unit]);

  function updateAmount(value: number) {
    setAmount(value);
    if (autoCalculate && base && scalingAvailable && Number.isFinite(value) && value > 0) {
      setNutrition(scaleNutrition(base.nutrition, value, base.amount));
    }
  }

  function updateUnit(value: string) {
    setUnit(value);
    if (base && value.trim() !== base.unit.trim()) setAutoCalculate(false);
  }

  function updateNutrition(key: keyof NutritionValues, value: number) {
    setAutoCalculate(false);
    setNutrition((current) => ({ ...current, [key]: value }));
  }

  function toggleAutoCalculate() {
    if (!base || !scalingAvailable) return;
    const next = !autoCalculate;
    setAutoCalculate(next);
    if (next && amount > 0) setNutrition(scaleNutrition(base.nutrition, amount, base.amount));
  }

  function consumedAtFromForm(): string {
    const match = /^(\d{2}):(\d{2})$/.exec(time);
    if (!match) throw new Error('请选择有效的记录时间。');
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) throw new Error('请选择有效的记录时间。');
    const value = localDateFromKey(selectedDate, hour);
    value.setMinutes(minute, 0, 0);
    return value.toISOString();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanUnit = unit.trim();
    if (!cleanName) {
      setFormError('请输入食物名称。');
      return;
    }
    if (!cleanUnit) {
      setFormError('请输入数量单位。');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0 || !isValidNutrition(nutrition)) {
      setFormError('数量必须大于 0，营养数据不能为负数。');
      return;
    }

    try {
      const consumedAt = consumedAtFromForm();
      setFormError('');
      await onSubmit({
        id: editingEntry?.id ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
        foodId: editingEntry?.foodId ?? sourceFood?.id ?? null,
        name: cleanName,
        meal: selectedMeal,
        consumedAt,
        amount,
        unit: cleanUnit,
        ...nutrition,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '记录时间无效。');
    }
  }

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section className="food-modal" role="dialog" aria-modal="true" aria-labelledby="food-modal-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">{editingEntry ? '修改记录' : '新增记录'} · {recordLabel}</p>
            <h2 id="food-modal-title">{editingEntry ? '编辑饮食' : '记录饮食'}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" disabled={saving} onClick={onClose}>
            <X size={19} />
          </button>
        </div>

        {base && (
          <div className="nutrition-calculation-bar">
            <div><Calculator size={17} /><span>{scalingHint}</span></div>
            <button
              type="button"
              className={autoCalculate ? 'active' : ''}
              disabled={!scalingAvailable || saving}
              onClick={toggleAutoCalculate}
            >
              {autoCalculate ? <LockKeyhole size={15} /> : <UnlockKeyhole size={15} />}
              {autoCalculate ? '自动计算中' : '启用自动计算'}
            </button>
          </div>
        )}

        <form onSubmit={submit}>
          <label>
            食物名称
            <input value={name} onChange={(event) => setName(event.target.value)} autoFocus required />
          </label>
          <div className="form-grid">
            <label>
              餐次
              <select value={selectedMeal} onChange={(event) => onMealChange(event.target.value as MealType)}>
                {meals.map((meal) => <option key={meal}>{meal}</option>)}
              </select>
            </label>
            <label>
              时间
              <input type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
            </label>
            <label>
              数量
              <input type="number" min="0.1" step="0.1" value={amount} onChange={(event) => updateAmount(Number(event.target.value))} required />
            </label>
            <label>
              单位
              <input value={unit} onChange={(event) => updateUnit(event.target.value)} required />
            </label>
            <label>
              热量 kcal
              <input type="number" min="0" step="0.1" value={nutrition.calories} onChange={(event) => updateNutrition('calories', Number(event.target.value))} required />
            </label>
            <label>
              蛋白质 g
              <input type="number" min="0" step="0.1" value={nutrition.protein} onChange={(event) => updateNutrition('protein', Number(event.target.value))} required />
            </label>
            <label>
              碳水 g
              <input type="number" min="0" step="0.1" value={nutrition.carbs} onChange={(event) => updateNutrition('carbs', Number(event.target.value))} required />
            </label>
            <label>
              脂肪 g
              <input type="number" min="0" step="0.1" value={nutrition.fat} onChange={(event) => updateNutrition('fat', Number(event.target.value))} required />
            </label>
          </div>
          {(formError || externalError) && <p className="form-error" role="alert">{formError || externalError}</p>}
          <div className="modal-actions">
            <button type="button" className="ghost" disabled={saving} onClick={onClose}>取消</button>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? '保存中…' : editingEntry ? '保存修改' : '保存记录'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
