import { FOOD_CATALOG_BY_ID } from '../data/foodCatalog';
import { foodRepository, type Food } from '../repositories/foodRepository';

export interface NutritionEstimate {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodRecognitionResult {
  food: Food;
  originalText: string;
  matchedText: string;
  amount: number;
  unit: string;
  equivalentBaseAmount: number;
  multiplier: number;
  nutrition: NutritionEstimate;
  confidence: number;
  confidenceLabel: '高' | '中' | '低';
  note: string;
}

export interface FoodRecognitionResponse {
  result: FoodRecognitionResult | null;
  suggestions: Array<{ food: Food; score: number }>;
  error: string | null;
}

export interface FoodRecognitionBatchItem {
  text: string;
  response: FoodRecognitionResponse;
}

export interface FoodRecognitionBatchResponse {
  items: FoodRecognitionBatchItem[];
  isBatch: boolean;
  error: string | null;
}

type ParsedQuantity = {
  amount: number | null;
  unit: string | null;
  remainingText: string;
  explicit: boolean;
};

const UNIT_ALIASES: Record<string, string> = {
  g: 'g', 克: 'g', 公克: 'g', kg: 'kg', 公斤: 'kg', 千克: 'kg',
  ml: 'ml', 毫升: 'ml', cc: 'ml', l: 'l', 升: 'l', 公升: 'l',
  个: '个', 顆: '个', 颗: '个', 枚: '个', 只: '只', 根: '根', 片: '片',
  碗: '碗', 杯: '杯', 份: '份', 勺: '勺', 汤匙: '勺', 包: '包', 块: '块',
  罐: '罐', 盒: '盒', 瓶: '瓶', 把: '把',
};

const CHINESE_NUMBERS: Record<string, number> = {
  半: 0.5, 一: 1, 壹: 1, 二: 2, 两: 2, 兩: 2, 三: 3, 四: 4,
  五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

const STOP_WORDS = [
  '我今天', '今天', '早餐', '早饭', '午餐', '午饭', '晚餐', '晚饭', '加餐',
  '训练后', '运动后', '刚刚', '刚才', '大概', '大约', '差不多', '约',
  '吃了', '喝了', '吃', '喝', '摄入', '记录', '帮我', '一共',
];

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function normalizeFoodText(value: string): string {
  return value
    .toLocaleLowerCase('zh-CN')
    .replace(/[，。！？、,!.?;；:：()（）\[\]【】'"“”‘’\s]/g, '')
    .replace(/千卡|大卡|卡路里|kcal/g, '')
    .trim();
}

function canonicalUnit(value: string | null | undefined): string | null {
  if (!value) return null;
  return UNIT_ALIASES[value.toLocaleLowerCase('zh-CN')] ?? value;
}

function stripStopWords(value: string): string {
  let output = value;
  for (const word of STOP_WORDS) output = output.replaceAll(word, '');
  return output;
}

function parseQuantity(input: string): ParsedQuantity {
  const normalized = input.toLocaleLowerCase('zh-CN').replace(/公克/g, '克').replace(/公升/g, '升');
  const numericPattern = /(\d+(?:\.\d+)?)\s*(公斤|千克|kg|克|g|毫升|ml|cc|升|l|个|顆|颗|枚|只|根|片|碗|杯|份|勺|汤匙|包|块|罐|盒|瓶|把)/i;
  const numericMatch = normalized.match(numericPattern);
  if (numericMatch) {
    const amount = Number(numericMatch[1]);
    return {
      amount: Number.isFinite(amount) && amount > 0 ? amount : null,
      unit: canonicalUnit(numericMatch[2]),
      remainingText: normalized.replace(numericMatch[0], ''),
      explicit: true,
    };
  }

  const chinesePattern = /(半|一|壹|二|两|兩|三|四|五|六|七|八|九|十)\s*(个|顆|颗|枚|只|根|片|碗|杯|份|勺|汤匙|包|块|罐|盒|瓶|把)/;
  const chineseMatch = normalized.match(chinesePattern);
  if (chineseMatch) {
    return {
      amount: CHINESE_NUMBERS[chineseMatch[1]] ?? null,
      unit: canonicalUnit(chineseMatch[2]),
      remainingText: normalized.replace(chineseMatch[0], ''),
      explicit: true,
    };
  }

  const amountOnlyMatch = normalized.match(/(\d+(?:\.\d+)?)/);
  if (amountOnlyMatch) {
    const amount = Number(amountOnlyMatch[1]);
    return {
      amount: Number.isFinite(amount) && amount > 0 ? amount : null,
      unit: null,
      remainingText: normalized.replace(amountOnlyMatch[0], ''),
      explicit: true,
    };
  }

  return { amount: null, unit: null, remainingText: normalized, explicit: false };
}

function bigrams(value: string): Set<string> {
  if (value.length <= 1) return new Set(value ? [value] : []);
  const output = new Set<string>();
  for (let index = 0; index < value.length - 1; index += 1) output.add(value.slice(index, index + 2));
  return output;
}

function similarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) {
    const shorter = Math.min(left.length, right.length);
    const longer = Math.max(left.length, right.length);
    return 0.78 + (shorter / longer) * 0.18;
  }
  const leftBigrams = bigrams(left);
  const rightBigrams = bigrams(right);
  if (leftBigrams.size === 0 || rightBigrams.size === 0) return 0;
  let intersection = 0;
  for (const item of leftBigrams) if (rightBigrams.has(item)) intersection += 1;
  return (2 * intersection) / (leftBigrams.size + rightBigrams.size);
}

function aliasesForFood(food: Food): string[] {
  return [food.name, ...(FOOD_CATALOG_BY_ID.get(food.id)?.aliases ?? [])];
}

function scoreFood(food: Food, query: string): { score: number; matchedText: string } {
  const normalizedQuery = normalizeFoodText(query);
  let bestScore = 0;
  let matchedText = food.name;
  for (const alias of aliasesForFood(food)) {
    const normalizedAlias = normalizeFoodText(alias);
    if (!normalizedAlias) continue;
    let score = similarity(normalizedQuery, normalizedAlias);
    if (normalizedQuery === normalizedAlias) score = 1;
    if (normalizedQuery.includes(normalizedAlias) && normalizedAlias.length >= 2) score = Math.max(score, 0.97);
    if (normalizedAlias.includes(normalizedQuery) && normalizedQuery.length >= 2) score = Math.max(score, 0.88);
    if (score > bestScore) {
      bestScore = score;
      matchedText = alias;
    }
  }
  if (food.isFavorite) bestScore += 0.015;
  bestScore += Math.min(food.usageCount, 20) * 0.001;
  return { score: Math.min(bestScore, 1), matchedText };
}

function convertToBaseAmount(food: Food, amount: number, unit: string) {
  const inputUnit = canonicalUnit(unit) ?? unit;
  const baseUnit = canonicalUnit(food.baseUnit) ?? food.baseUnit;
  const catalog = FOOD_CATALOG_BY_ID.get(food.id);
  if (inputUnit === baseUnit) return { equivalent: amount, note: `按 ${amount}${unit} 计算`, penalty: 0 };
  if (inputUnit === 'kg' && baseUnit === 'g') return { equivalent: amount * 1000, note: `已将 ${amount}kg 换算为克`, penalty: 0 };
  if (inputUnit === 'g' && baseUnit === 'kg') return { equivalent: amount / 1000, note: `已将 ${amount}g 换算为公斤`, penalty: 0 };
  if (inputUnit === 'l' && baseUnit === 'ml') return { equivalent: amount * 1000, note: `已将 ${amount}L 换算为毫升`, penalty: 0 };
  if (inputUnit === 'ml' && baseUnit === 'l') return { equivalent: amount / 1000, note: `已将 ${amount}ml 换算为升`, penalty: 0 };
  const portionAmount = catalog?.portions?.[inputUnit];
  if (portionAmount) {
    return {
      equivalent: amount * portionAmount,
      note: `按 1${unit}≈${portionAmount}${food.baseUnit} 估算`,
      penalty: 0.08,
    };
  }
  return {
    equivalent: amount * food.baseAmount,
    note: `未找到“${unit}”的标准换算，暂按 1${unit}=1 个基准份估算`,
    penalty: 0.18,
  };
}

function confidenceLabel(value: number): '高' | '中' | '低' {
  if (value >= 0.86) return '高';
  if (value >= 0.68) return '中';
  return '低';
}

function catalogFallbackFoods(savedFoods: Food[]): Food[] {
  const savedIds = new Set(savedFoods.map((food) => food.id));
  const now = new Date().toISOString();
  return [...FOOD_CATALOG_BY_ID.values()]
    .filter((definition) => !savedIds.has(definition.id))
    .map((definition) => ({
      id: definition.id,
      name: definition.name,
      category: definition.category,
      baseAmount: definition.baseAmount,
      baseUnit: definition.baseUnit,
      calories: definition.calories,
      protein: definition.protein,
      carbs: definition.carbs,
      fat: definition.fat,
      isFavorite: false,
      isCustom: false,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    }));
}

async function availableFoods(): Promise<Food[]> {
  const savedFoods = await foodRepository.getAll();
  return [...savedFoods, ...catalogFallbackFoods(savedFoods)];
}

function buildResult(
  originalText: string,
  food: Food,
  matchedText: string,
  parsed: ParsedQuantity,
  matchConfidence: number,
  selectedByUser = false,
): FoodRecognitionResult {
  const amount = parsed.amount ?? food.baseAmount;
  const unit = parsed.unit ?? food.baseUnit;
  const converted = convertToBaseAmount(food, amount, unit);
  const multiplier = converted.equivalent / food.baseAmount;
  const nutrition = {
    calories: round(food.calories * multiplier),
    protein: round(food.protein * multiplier),
    carbs: round(food.carbs * multiplier),
    fat: round(food.fat * multiplier),
  };
  const confidence = Math.max(
    0.35,
    Math.min(0.99, matchConfidence - (parsed.explicit ? 0 : 0.08) - converted.penalty),
  );
  const quantityNote = parsed.explicit
    ? converted.note
    : `未写份量，按默认 ${food.baseAmount}${food.baseUnit} 估算`;
  const identityNote = selectedByUser ? '食物由你从候选中确认' : `名称匹配为“${matchedText}”`;

  return {
    food,
    originalText,
    matchedText,
    amount,
    unit,
    equivalentBaseAmount: round(converted.equivalent),
    multiplier,
    nutrition,
    confidence: round(confidence * 100),
    confidenceLabel: confidenceLabel(confidence),
    note: `${identityNote}；${quantityNote}。营养值为通用估算，品牌和烹饪方式会造成差异。`,
  };
}

function recognizeAgainstFoods(originalText: string, foods: Food[]): FoodRecognitionResponse {
  if (originalText.length < 2) {
    return { result: null, suggestions: [], error: '请输入食物名称，例如“200g鸡胸肉”。' };
  }

  const parsed = parseQuantity(originalText);
  const foodQuery = normalizeFoodText(stripStopWords(parsed.remainingText));
  if (!foodQuery) return { result: null, suggestions: [], error: '没有识别到食物名称，请补充名称和份量。' };

  const ranked = foods
    .map((food) => ({ food, ...scoreFood(food, foodQuery) }))
    .filter((item) => item.score >= 0.28)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);

  const suggestions = ranked.map(({ food, score }) => ({ food, score: round(score * 100) }));
  const best = ranked[0];
  if (!best || best.score < 0.48) {
    return { result: null, suggestions, error: '暂时无法可靠匹配该食物。请选择候选，或先添加自定义食物。' };
  }

  return {
    result: buildResult(originalText, best.food, best.matchedText, parsed, best.score),
    suggestions,
    error: null,
  };
}

export function splitFoodDescriptions(input: string): string[] {
  const segments = input
    .replace(/(?:以及|还有|加上)/g, '、')
    .split(/[、，,；;+＋]|(?:和)/)
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(segments)].slice(0, 8);
}

export async function recognizeFoodText(input: string): Promise<FoodRecognitionResponse> {
  const originalText = input.trim();
  return recognizeAgainstFoods(originalText, await availableFoods());
}

export async function recognizeFoodBatchText(input: string): Promise<FoodRecognitionBatchResponse> {
  const originalText = input.trim();
  if (!originalText) return { items: [], isBatch: false, error: '请输入食物和份量。' };
  const segments = splitFoodDescriptions(originalText);
  const foods = await availableFoods();
  const items = (segments.length > 0 ? segments : [originalText]).map((text) => ({
    text,
    response: recognizeAgainstFoods(text, foods),
  }));
  return {
    items,
    isBatch: items.length > 1,
    error: items.every((item) => item.response.result == null)
      ? '没有识别出可直接使用的食物，请从候选中确认或使用手动录入。'
      : null,
  };
}

export async function confirmFoodSuggestion(input: string, food: Food): Promise<FoodRecognitionResult> {
  const originalText = input.trim();
  if (!originalText) throw new Error('食物描述不能为空');
  const parsed = parseQuantity(originalText);
  return buildResult(originalText, food, food.name, parsed, 0.97, true);
}
