export type CatalogFoodCategory =
  | '蛋白质来源'
  | '主食'
  | '水果'
  | '蔬菜'
  | '乳制品'
  | '坚果'
  | '补剂'
  | '常见外食'
  | '其他';

export interface FoodCatalogEntry {
  id: string;
  name: string;
  category: CatalogFoodCategory;
  baseAmount: number;
  baseUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  aliases: string[];
  portions?: Record<string, number>;
}

export const FOOD_CATALOG: FoodCatalogEntry[] = [
  { id: 'seed-chicken-breast', name: '鸡胸肉', category: '蛋白质来源', baseAmount: 100, baseUnit: 'g', calories: 165, protein: 31, carbs: 0, fat: 3.6, aliases: ['鸡胸', '鸡胸脯', '水煮鸡胸', '煎鸡胸'], portions: { 块: 150, 份: 150 } },
  { id: 'seed-chicken-thigh', name: '去皮鸡腿肉', category: '蛋白质来源', baseAmount: 100, baseUnit: 'g', calories: 177, protein: 24, carbs: 0, fat: 8, aliases: ['鸡腿肉', '去皮鸡腿', '鸡腿'], portions: { 块: 120, 只: 120, 份: 150 } },
  { id: 'seed-egg', name: '鸡蛋', category: '蛋白质来源', baseAmount: 1, baseUnit: '个', calories: 70, protein: 6.3, carbs: 0.6, fat: 4.8, aliases: ['全蛋', '水煮蛋', '煎蛋', '蛋'] },
  { id: 'seed-egg-white', name: '蛋白', category: '蛋白质来源', baseAmount: 1, baseUnit: '个', calories: 17, protein: 3.6, carbs: 0.2, fat: 0, aliases: ['鸡蛋白', '蛋清'] },
  { id: 'seed-beef', name: '瘦牛肉', category: '蛋白质来源', baseAmount: 100, baseUnit: 'g', calories: 250, protein: 26, carbs: 0, fat: 15, aliases: ['牛肉', '牛里脊', '瘦牛排'], portions: { 块: 150, 份: 150 } },
  { id: 'seed-pork-tenderloin', name: '猪里脊', category: '蛋白质来源', baseAmount: 100, baseUnit: 'g', calories: 143, protein: 26, carbs: 0, fat: 3.5, aliases: ['里脊肉', '瘦猪肉', '猪瘦肉'], portions: { 份: 150 } },
  { id: 'seed-salmon', name: '三文鱼', category: '蛋白质来源', baseAmount: 100, baseUnit: 'g', calories: 208, protein: 20, carbs: 0, fat: 13, aliases: ['鲑鱼', '煎三文鱼'], portions: { 块: 150, 份: 150 } },
  { id: 'seed-tuna', name: '水浸金枪鱼', category: '蛋白质来源', baseAmount: 100, baseUnit: 'g', calories: 116, protein: 26, carbs: 0, fat: 1, aliases: ['金枪鱼', '吞拿鱼', '金枪鱼罐头'], portions: { 罐: 130, 份: 100 } },
  { id: 'seed-shrimp', name: '虾仁', category: '蛋白质来源', baseAmount: 100, baseUnit: 'g', calories: 99, protein: 24, carbs: 0.2, fat: 0.3, aliases: ['虾', '白虾', '水煮虾'], portions: { 份: 120 } },
  { id: 'seed-tofu', name: '北豆腐', category: '蛋白质来源', baseAmount: 100, baseUnit: 'g', calories: 98, protein: 10.9, carbs: 2.9, fat: 5.3, aliases: ['豆腐', '老豆腐', '板豆腐'], portions: { 块: 200, 份: 150 } },
  { id: 'seed-rice', name: '熟米饭', category: '主食', baseAmount: 100, baseUnit: 'g', calories: 116, protein: 2.6, carbs: 25.9, fat: 0.3, aliases: ['米饭', '白饭', '白米饭', '熟饭'], portions: { 碗: 150, 份: 150 } },
  { id: 'seed-brown-rice', name: '熟糙米饭', category: '主食', baseAmount: 100, baseUnit: 'g', calories: 111, protein: 2.6, carbs: 23, fat: 0.9, aliases: ['糙米', '糙米饭'], portions: { 碗: 150, 份: 150 } },
  { id: 'seed-oats', name: '燕麦片', category: '主食', baseAmount: 100, baseUnit: 'g', calories: 380, protein: 13, carbs: 68, fat: 7, aliases: ['燕麦', '即食燕麦', '纯燕麦'], portions: { 碗: 40, 杯: 80, 份: 40 } },
  { id: 'seed-noodles', name: '熟面条', category: '主食', baseAmount: 100, baseUnit: 'g', calories: 138, protein: 4.5, carbs: 25, fat: 2, aliases: ['面条', '煮面', '白面条'], portions: { 碗: 250, 份: 250 } },
  { id: 'seed-whole-wheat-bread', name: '全麦面包', category: '主食', baseAmount: 1, baseUnit: '片', calories: 80, protein: 4, carbs: 14, fat: 1.2, aliases: ['全麦吐司', '吐司', '面包片'] },
  { id: 'seed-sweet-potato', name: '红薯', category: '主食', baseAmount: 100, baseUnit: 'g', calories: 86, protein: 1.6, carbs: 20.1, fat: 0.1, aliases: ['地瓜', '番薯', '烤红薯'], portions: { 个: 200, 根: 200, 份: 200 } },
  { id: 'seed-potato', name: '土豆', category: '主食', baseAmount: 100, baseUnit: 'g', calories: 77, protein: 2, carbs: 17, fat: 0.1, aliases: ['马铃薯', '洋芋', '蒸土豆'], portions: { 个: 170, 份: 170 } },
  { id: 'seed-corn', name: '玉米', category: '主食', baseAmount: 100, baseUnit: 'g', calories: 96, protein: 3.4, carbs: 21, fat: 1.5, aliases: ['甜玉米', '煮玉米', '玉米棒'], portions: { 根: 150, 个: 150 } },
  { id: 'seed-banana', name: '香蕉', category: '水果', baseAmount: 1, baseUnit: '根', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, aliases: ['芭蕉'] },
  { id: 'seed-apple', name: '苹果', category: '水果', baseAmount: 1, baseUnit: '个', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, aliases: ['红苹果', '青苹果'] },
  { id: 'seed-orange', name: '橙子', category: '水果', baseAmount: 1, baseUnit: '个', calories: 62, protein: 1.2, carbs: 15.4, fat: 0.2, aliases: ['柳橙', '甜橙'] },
  { id: 'seed-blueberry', name: '蓝莓', category: '水果', baseAmount: 100, baseUnit: 'g', calories: 57, protein: 0.7, carbs: 14.5, fat: 0.3, aliases: ['鲜蓝莓'], portions: { 盒: 125, 杯: 148 } },
  { id: 'seed-avocado', name: '牛油果', category: '水果', baseAmount: 100, baseUnit: 'g', calories: 160, protein: 2, carbs: 8.5, fat: 14.7, aliases: ['鳄梨'], portions: { 个: 150 } },
  { id: 'seed-milk', name: '脱脂牛奶', category: '乳制品', baseAmount: 100, baseUnit: 'ml', calories: 35, protein: 3.4, carbs: 5, fat: 0.2, aliases: ['脱脂奶', '低脂牛奶'], portions: { 杯: 250, 盒: 250, 瓶: 250 } },
  { id: 'seed-whole-milk', name: '全脂牛奶', category: '乳制品', baseAmount: 100, baseUnit: 'ml', calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, aliases: ['纯牛奶', '牛奶', '全脂奶'], portions: { 杯: 250, 盒: 250, 瓶: 250 } },
  { id: 'seed-yogurt', name: '无糖希腊酸奶', category: '乳制品', baseAmount: 100, baseUnit: 'g', calories: 73, protein: 9, carbs: 4, fat: 2.2, aliases: ['希腊酸奶', '无糖酸奶', '高蛋白酸奶'], portions: { 杯: 150, 盒: 150 } },
  { id: 'seed-soy-milk', name: '无糖豆浆', category: '乳制品', baseAmount: 100, baseUnit: 'ml', calories: 33, protein: 3.3, carbs: 1.8, fat: 1.8, aliases: ['豆浆', '无糖豆奶'], portions: { 杯: 300, 盒: 250 } },
  { id: 'seed-broccoli', name: '西兰花', category: '蔬菜', baseAmount: 100, baseUnit: 'g', calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4, aliases: ['绿花菜', '青花菜'], portions: { 份: 150 } },
  { id: 'seed-spinach', name: '菠菜', category: '蔬菜', baseAmount: 100, baseUnit: 'g', calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, aliases: ['烫菠菜'], portions: { 份: 150 } },
  { id: 'seed-tomato', name: '番茄', category: '蔬菜', baseAmount: 100, baseUnit: 'g', calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, aliases: ['西红柿', '小番茄'], portions: { 个: 150, 份: 150 } },
  { id: 'seed-cucumber', name: '黄瓜', category: '蔬菜', baseAmount: 100, baseUnit: 'g', calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, aliases: ['青瓜'], portions: { 根: 200, 份: 150 } },
  { id: 'seed-almonds', name: '杏仁', category: '坚果', baseAmount: 30, baseUnit: 'g', calories: 174, protein: 6.4, carbs: 6.5, fat: 15, aliases: ['巴旦木'], portions: { 把: 30, 份: 30 } },
  { id: 'seed-walnuts', name: '核桃', category: '坚果', baseAmount: 30, baseUnit: 'g', calories: 196, protein: 4.6, carbs: 4.1, fat: 19.6, aliases: ['核桃仁'], portions: { 把: 30, 份: 30 } },
  { id: 'seed-peanut-butter', name: '花生酱', category: '坚果', baseAmount: 15, baseUnit: 'g', calories: 90, protein: 3.8, carbs: 3, fat: 7.5, aliases: ['无糖花生酱'], portions: { 勺: 15, 份: 15 } },
  { id: 'seed-whey', name: '乳清蛋白粉', category: '补剂', baseAmount: 30, baseUnit: 'g', calories: 120, protein: 24, carbs: 3, fat: 2, aliases: ['蛋白粉', '乳清', 'whey'], portions: { 勺: 30, 份: 30 } },
  { id: 'seed-creatine', name: '肌酸', category: '补剂', baseAmount: 5, baseUnit: 'g', calories: 0, protein: 0, carbs: 0, fat: 0, aliases: ['一水肌酸'], portions: { 勺: 5, 份: 5 } },
  { id: 'seed-dumpling', name: '水饺', category: '常见外食', baseAmount: 1, baseUnit: '个', calories: 45, protein: 2.2, carbs: 6.5, fat: 1.2, aliases: ['饺子', '煮饺子'], portions: { 份: 10 } },
  { id: 'seed-steamed-bun', name: '肉包', category: '常见外食', baseAmount: 1, baseUnit: '个', calories: 210, protein: 7, carbs: 40, fat: 2, aliases: ['包子', '肉包子'] },
  { id: 'seed-fried-rice', name: '蛋炒饭', category: '常见外食', baseAmount: 100, baseUnit: 'g', calories: 164, protein: 4.3, carbs: 26, fat: 4.6, aliases: ['炒饭'], portions: { 碗: 300, 份: 300 } },
  { id: 'seed-chicken-rice', name: '鸡肉饭', category: '常见外食', baseAmount: 1, baseUnit: '份', calories: 620, protein: 35, carbs: 78, fat: 18, aliases: ['鸡胸饭', '健身餐鸡肉饭'] },
  { id: 'seed-instant-noodles', name: '方便面', category: '常见外食', baseAmount: 1, baseUnit: '包', calories: 470, protein: 9, carbs: 62, fat: 20, aliases: ['泡面', '速食面'] },
  { id: 'seed-latte', name: '拿铁咖啡', category: '其他', baseAmount: 250, baseUnit: 'ml', calories: 130, protein: 7, carbs: 12, fat: 6, aliases: ['拿铁', '牛奶咖啡'], portions: { 杯: 250 } },
  { id: 'seed-black-coffee', name: '黑咖啡', category: '其他', baseAmount: 250, baseUnit: 'ml', calories: 3, protein: 0.3, carbs: 0, fat: 0, aliases: ['美式咖啡', '美式', '咖啡'], portions: { 杯: 250 } },
  { id: 'seed-bubble-tea', name: '珍珠奶茶', category: '其他', baseAmount: 500, baseUnit: 'ml', calories: 450, protein: 6, carbs: 78, fat: 12, aliases: ['奶茶', '波霸奶茶'], portions: { 杯: 500 } },
];

export const FOOD_CATALOG_BY_ID = new Map(FOOD_CATALOG.map((food) => [food.id, food]));
