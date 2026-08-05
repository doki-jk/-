import type { FoodEntry } from '../types';
export const initialFoods: FoodEntry[] = [
{id:'1',name:'燕麦片',meal:'早餐',amount:80,unit:'g',calories:304,protein:10.4,carbs:54.4,fat:5.6},
{id:'2',name:'脱脂牛奶',meal:'早餐',amount:300,unit:'ml',calories:105,protein:10.2,carbs:15,fat:0.6},
{id:'3',name:'鸡胸肉',meal:'午餐',amount:200,unit:'g',calories:330,protein:62,carbs:0,fat:7.2},
{id:'4',name:'米饭',meal:'午餐',amount:250,unit:'g',calories:290,protein:6.5,carbs:63,fat:0.8},
{id:'5',name:'香蕉',meal:'加餐',amount:1,unit:'根',calories:105,protein:1.3,carbs:27,fat:0.4}
];
export const weeklyCalories = [
{day:'周一',value:2180},{day:'周二',value:2260},{day:'周三',value:2050},{day:'周四',value:2340},{day:'周五',value:2210},{day:'周六',value:2410},{day:'今天',value:1134}
];
