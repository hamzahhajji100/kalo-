import { normalize } from './normalize';

/**
 * Synonym groups (German, English and common spellings). Every term in a group finds the others.
 * Terms are normalised at load time, so they can be written naturally here.
 */
export const SYNONYM_GROUPS: readonly string[][] = [
  ['Hähnchen', 'Huhn', 'Hühnchen', 'Hendl', 'Poulet', 'Geflügel', 'Chicken', 'Broiler'],
  ['Hähnchenbrust', 'Hühnerbrust', 'Hähnchenbrustfilet', 'Chicken breast'],
  ['Pute', 'Truthahn', 'Turkey'],
  ['Rind', 'Rindfleisch', 'Beef'],
  ['Hackfleisch', 'Hack', 'Faschiertes', 'Ground beef', 'Mince'],
  ['Schwein', 'Schweinefleisch', 'Pork'],
  ['Lachs', 'Salmon'],
  ['Thunfisch', 'Tuna'],
  ['Garnelen', 'Shrimps', 'Krabben', 'Shrimp', 'Prawns'],
  ['Ei', 'Eier', 'Egg', 'Eggs'],
  ['Milch', 'Milk'],
  ['Joghurt', 'Jogurt', 'Yoghurt', 'Yogurt'],
  ['Quark', 'Topfen', 'Magerquark', 'Speisequark'],
  ['Skyr', 'Isländischer Joghurt'],
  ['Käse', 'Kaese', 'Cheese'],
  ['Frischkäse', 'Cream cheese'],
  ['Hüttenkäse', 'Körniger Frischkäse', 'Cottage cheese'],
  ['Butter'],
  ['Sahne', 'Rahm', 'Schlagsahne', 'Cream'],
  ['Haferflocken', 'Hafer', 'Oats', 'Oatmeal', 'Rolled oats', 'Porridge'],
  ['Müsli', 'Muesli', 'Granola'],
  ['Brot', 'Bread'],
  ['Brötchen', 'Semmel', 'Schrippe', 'Weckle', 'Roll', 'Bun'],
  ['Vollkornbrot', 'Whole wheat bread', 'Wholemeal bread'],
  ['Nudeln', 'Pasta', 'Teigwaren', 'Spaghetti', 'Noodles'],
  ['Reis', 'Rice'],
  ['Couscous', 'Kuskus'],
  ['Kartoffel', 'Kartoffeln', 'Erdapfel', 'Potato', 'Potatoes'],
  ['Pommes', 'Pommes frites', 'Fritten', 'French fries', 'Fries'],
  ['Süßkartoffel', 'Sweet potato'],
  ['Banane', 'Banana'],
  ['Apfel', 'Äpfel', 'Apple'],
  ['Orange', 'Apfelsine'],
  ['Erdbeere', 'Erdbeeren', 'Strawberry', 'Strawberries'],
  ['Heidelbeere', 'Blaubeere', 'Blueberry', 'Blueberries'],
  ['Tomate', 'Tomaten', 'Paradeiser', 'Tomato'],
  ['Gurke', 'Salatgurke', 'Cucumber'],
  ['Paprika', 'Bell pepper'],
  ['Brokkoli', 'Broccoli'],
  ['Möhre', 'Karotte', 'Rübli', 'Carrot'],
  ['Zwiebel', 'Onion'],
  ['Knoblauch', 'Garlic'],
  ['Spinat', 'Spinach'],
  ['Salat', 'Kopfsalat', 'Lettuce', 'Salad'],
  ['Avocado'],
  ['Linsen', 'Lentils'],
  ['Kichererbsen', 'Chickpeas', 'Garbanzo'],
  ['Bohnen', 'Beans'],
  ['Tofu'],
  ['Erdnussbutter', 'Erdnussmus', 'Peanut butter'],
  ['Mandeln', 'Almonds'],
  ['Walnüsse', 'Walnuts'],
  ['Nüsse', 'Nuts'],
  ['Olivenöl', 'Olive oil'],
  ['Öl', 'Oil'],
  ['Zucker', 'Sugar'],
  ['Honig', 'Honey'],
  ['Schokolade', 'Chocolate'],
  ['Kaffee', 'Coffee'],
  ['Tee', 'Tea'],
  ['Saft', 'Juice'],
  ['Bier', 'Beer'],
  ['Wein', 'Wine'],
  ['Wasser', 'Water'],
  ['Döner', 'Doner', 'Döner Kebab', 'Kebab', 'Kebap', 'Dürüm', 'Durum'],
  ['Pizza'],
  ['Burger', 'Hamburger', 'Cheeseburger'],
  ['Currywurst'],
  ['Bratwurst', 'Wurst', 'Sausage'],
  ['Schnitzel', 'Wiener Schnitzel'],
  ['Pfannkuchen', 'Eierkuchen', 'Palatschinken', 'Pancake', 'Pancakes'],
  ['Proteinriegel', 'Eiweißriegel', 'Protein bar'],
  ['Proteinpulver', 'Eiweißpulver', 'Whey', 'Protein powder'],
  ['Müsliriegel', 'Granola bar', 'Cereal bar'],
  ['Brezel', 'Breze', 'Laugenbrezel', 'Pretzel'],
  ['Croissant', 'Hörnchen'],
  ['Kuchen', 'Cake'],
  ['Eis', 'Speiseeis', 'Ice cream'],
  ['Chips', 'Kartoffelchips', 'Crisps', 'Potato chips'],
  ['Hummus', 'Humus'],
  ['Feta', 'Schafskäse'],
  ['Mozzarella'],
  ['Wrap', 'Tortilla'],
  ['Sushi'],
];

export type SynonymIndex = Map<string, string[]>;

/** term → other normalised terms of its group(s). */
export function buildSynonymIndex(groups: readonly string[][] = SYNONYM_GROUPS): SynonymIndex {
  const index: SynonymIndex = new Map();
  for (const group of groups) {
    const terms = [...new Set(group.map(normalize))];
    for (const t of terms) {
      const others = terms.filter((o) => o !== t);
      index.set(t, [...new Set([...(index.get(t) ?? []), ...others])]);
    }
  }
  return index;
}
