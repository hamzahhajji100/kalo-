/**
 * German names for common basic foods from USDA SR Legacy / Foundation.
 * Only names (and optional German portion labels) are curated here; all nutrient values come from
 * the USDA release during import. Descriptions that do not exist in the release are reported by the
 * build script instead of being silently invented.
 */
export interface BasicFood {
  /** Exact USDA description. */
  usda: string;
  de: string;
  liquid?: boolean;
  /** German portion labels (grams) shown before USDA's English portions. */
  portions?: { label: string; grams: number }[];
}

export const BASICS_DE: BasicFood[] = [
  // Geflügel, Fleisch, Fisch
  { usda: 'Chicken, broilers or fryers, breast, meat only, raw', de: 'Hähnchenbrust, roh' },
  {
    usda: 'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
    de: 'Hähnchenbrust, gebraten',
  },
  {
    usda: 'Chicken, broilers or fryers, thigh, meat only, raw',
    de: 'Hähnchenschenkel ohne Haut, roh',
  },
  { usda: 'Turkey, whole, breast, meat only, raw', de: 'Putenbrust, roh' },
  { usda: 'Beef, ground, 80% lean meat / 20% fat, raw', de: 'Rinderhackfleisch (20 % Fett), roh' },
  {
    usda: 'Beef, ground, 90% lean meat / 10% fat, raw',
    de: 'Rinderhackfleisch mager (10 % Fett), roh',
  },
  { usda: 'Pork, fresh, loin, tenderloin, separable lean only, raw', de: 'Schweinefilet, roh' },
  { usda: 'Fish, salmon, Atlantic, farmed, raw', de: 'Lachs (Zucht), roh' },
  { usda: 'Fish, cod, Atlantic, raw', de: 'Kabeljau, roh' },
  {
    usda: 'Fish, tuna, light, canned in water, drained solids',
    de: 'Thunfisch im eigenen Saft, abgetropft',
  },
  { usda: 'Crustaceans, shrimp, raw', de: 'Garnelen, roh' },
  // Eier & Milchprodukte
  {
    usda: 'Egg, whole, raw, fresh',
    de: 'Hühnerei, roh',
    portions: [
      { label: '1 Ei (M)', grams: 55 },
      { label: '1 Ei (L)', grams: 65 },
    ],
  },
  {
    usda: 'Egg, whole, cooked, hard-boiled',
    de: 'Ei, hart gekocht',
    portions: [{ label: '1 Ei (M)', grams: 50 }],
  },
  { usda: 'Egg, white, raw, fresh', de: 'Eiklar, roh' },
  {
    usda: 'Milk, whole, 3.25% milkfat, with added vitamin D',
    de: 'Vollmilch (3,3 %)',
    liquid: true,
    portions: [{ label: '1 Glas', grams: 200 }],
  },
  {
    usda: 'Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D',
    de: 'Fettarme Milch (2 %)',
    liquid: true,
    portions: [{ label: '1 Glas', grams: 200 }],
  },
  {
    usda: 'Milk, nonfat, fluid, with added vitamin A and vitamin D (fat free or skim)',
    de: 'Magermilch',
    liquid: true,
  },
  { usda: 'Yogurt, plain, whole milk', de: 'Naturjoghurt (Vollmilch)' },
  { usda: 'Yogurt, Greek, plain, nonfat', de: 'Griechischer Joghurt, 0 % Fett' },
  { usda: 'Cheese, cottage, lowfat, 2% milkfat', de: 'Hüttenkäse (körniger Frischkäse)' },
  { usda: 'Cheese, gouda', de: 'Gouda', portions: [{ label: '1 Scheibe', grams: 20 }] },
  {
    usda: 'Cheese, mozzarella, whole milk',
    de: 'Mozzarella',
    portions: [{ label: '1 Kugel', grams: 125 }],
  },
  { usda: 'Cheese, feta', de: 'Feta / Schafskäse' },
  { usda: 'Cheese, parmesan, hard', de: 'Parmesan' },
  { usda: 'Cheese, cream', de: 'Frischkäse (Doppelrahm)' },
  {
    usda: 'Butter, without salt',
    de: 'Butter',
    portions: [
      { label: '1 TL', grams: 5 },
      { label: '1 EL', grams: 10 },
    ],
  },
  { usda: 'Butter, salted', de: 'Butter, gesalzen' },
  { usda: 'Cream, fluid, heavy whipping', de: 'Schlagsahne' },
  // Fette & Öle
  {
    usda: 'Oil, olive, salad or cooking',
    de: 'Olivenöl',
    portions: [{ label: '1 EL', grams: 10 }],
  },
  { usda: 'Oil, canola', de: 'Rapsöl', portions: [{ label: '1 EL', grams: 10 }] },
  // Getreide & Beilagen
  {
    usda: 'Cereals, oats, regular and quick, not fortified, dry',
    de: 'Haferflocken',
    portions: [
      { label: '1 EL', grams: 10 },
      { label: '1 Portion', grams: 50 },
    ],
  },
  { usda: 'Rice, white, long-grain, regular, raw, enriched', de: 'Reis, weiß, roh' },
  { usda: 'Rice, white, long-grain, regular, enriched, cooked', de: 'Reis, weiß, gekocht' },
  { usda: 'Rice, brown, long-grain, raw', de: 'Naturreis, roh' },
  { usda: 'Rice, brown, long-grain, cooked', de: 'Naturreis, gekocht' },
  {
    usda: 'Pasta, dry, enriched',
    de: 'Nudeln, roh',
    portions: [{ label: '1 Portion', grams: 100 }],
  },
  { usda: 'Pasta, cooked, enriched, without added salt', de: 'Nudeln, gekocht' },
  { usda: 'Couscous, dry', de: 'Couscous, roh' },
  { usda: 'Couscous, cooked', de: 'Couscous, gekocht' },
  { usda: 'Quinoa, uncooked', de: 'Quinoa, roh' },
  { usda: 'Quinoa, cooked', de: 'Quinoa, gekocht' },
  {
    usda: 'Bread, whole-wheat, commercially prepared',
    de: 'Vollkornbrot',
    portions: [{ label: '1 Scheibe', grams: 45 }],
  },
  {
    usda: 'Bread, white, commercially prepared (includes soft bread crumbs)',
    de: 'Weißbrot / Toast',
    portions: [{ label: '1 Scheibe', grams: 25 }],
  },
  { usda: 'Bread, rye', de: 'Roggenbrot', portions: [{ label: '1 Scheibe', grams: 45 }] },
  { usda: 'Potatoes, flesh and skin, raw', de: 'Kartoffeln, roh' },
  { usda: 'Potatoes, boiled, cooked without skin, flesh, without salt', de: 'Kartoffeln, gekocht' },
  { usda: 'Sweet potato, raw, unprepared', de: 'Süßkartoffel, roh' },
  {
    usda: 'Potatoes, french fried, all types, salt added in processing, frozen, oven-heated',
    de: 'Pommes frites (Ofen)',
  },
  // Obst
  { usda: 'Bananas, raw', de: 'Banane', portions: [{ label: '1 Banane (mittel)', grams: 120 }] },
  {
    usda: 'Apples, raw, with skin',
    de: 'Apfel',
    portions: [{ label: '1 Apfel (mittel)', grams: 180 }],
  },
  {
    usda: 'Oranges, raw, all commercial varieties',
    de: 'Orange',
    portions: [{ label: '1 Orange', grams: 150 }],
  },
  { usda: 'Strawberries, raw', de: 'Erdbeeren' },
  { usda: 'Blueberries, raw', de: 'Heidelbeeren' },
  { usda: 'Raspberries, raw', de: 'Himbeeren' },
  {
    usda: 'Grapes, red or green (European type, such as Thompson seedless), raw',
    de: 'Weintrauben',
  },
  { usda: 'Kiwifruit, green, raw', de: 'Kiwi', portions: [{ label: '1 Kiwi', grams: 75 }] },
  { usda: 'Pears, raw', de: 'Birne', portions: [{ label: '1 Birne', grams: 180 }] },
  { usda: 'Pineapple, raw, all varieties', de: 'Ananas' },
  { usda: 'Mangos, raw', de: 'Mango' },
  { usda: 'Watermelon, raw', de: 'Wassermelone' },
  { usda: 'Lemons, raw, without peel', de: 'Zitrone' },
  {
    usda: 'Avocados, raw, all commercial varieties',
    de: 'Avocado',
    portions: [{ label: '1/2 Avocado', grams: 70 }],
  },
  { usda: 'Peaches, yellow, raw', de: 'Pfirsich' },
  { usda: 'Cherries, sweet, raw', de: 'Kirschen' },
  { usda: 'Plums, raw', de: 'Pflaumen' },
  { usda: 'Raisins, seedless', de: 'Rosinen' },
  { usda: 'Dates, medjool', de: 'Datteln (Medjool)' },
  // Gemüse
  {
    usda: 'Tomatoes, red, ripe, raw, year round average',
    de: 'Tomate',
    portions: [{ label: '1 Tomate', grams: 120 }],
  },
  { usda: 'Cucumber, with peel, raw', de: 'Gurke' },
  { usda: 'Peppers, sweet, red, raw', de: 'Paprika, rot' },
  { usda: 'Peppers, sweet, green, raw', de: 'Paprika, grün' },
  { usda: 'Broccoli, raw', de: 'Brokkoli' },
  { usda: 'Carrots, raw', de: 'Möhre / Karotte' },
  { usda: 'Onions, raw', de: 'Zwiebel' },
  { usda: 'Garlic, raw', de: 'Knoblauch' },
  { usda: 'Spinach, raw', de: 'Spinat' },
  { usda: 'Lettuce, iceberg (includes crisphead types), raw', de: 'Eisbergsalat' },
  { usda: 'Cauliflower, raw', de: 'Blumenkohl' },
  { usda: 'Squash, summer, zucchini, includes skin, raw', de: 'Zucchini' },
  { usda: 'Mushrooms, white, raw', de: 'Champignons' },
  { usda: 'Cabbage, raw', de: 'Weißkohl' },
  { usda: 'Kale, raw', de: 'Grünkohl' },
  { usda: 'Corn, sweet, yellow, raw', de: 'Mais' },
  { usda: 'Eggplant, raw', de: 'Aubergine' },
  { usda: 'Asparagus, raw', de: 'Spargel, grün' },
  { usda: 'Beets, raw', de: 'Rote Bete' },
  { usda: 'Brussels sprouts, raw', de: 'Rosenkohl' },
  { usda: 'Beans, snap, green, raw', de: 'Grüne Bohnen' },
  // Hülsenfrüchte & Soja
  { usda: 'Lentils, raw', de: 'Linsen, roh' },
  { usda: 'Lentils, mature seeds, cooked, boiled, without salt', de: 'Linsen, gekocht' },
  { usda: 'Chickpeas (garbanzo beans, bengal gram), mature seeds, raw', de: 'Kichererbsen, roh' },
  {
    usda: 'Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt',
    de: 'Kichererbsen, gekocht',
  },
  {
    usda: 'Beans, kidney, red, mature seeds, cooked, boiled, without salt',
    de: 'Kidneybohnen, gekocht',
  },
  { usda: 'Tofu, raw, firm, prepared with calcium sulfate', de: 'Tofu (fest)' },
  { usda: 'Hummus, commercial', de: 'Hummus' },
  // Nüsse & Samen
  { usda: 'Nuts, almonds', de: 'Mandeln' },
  { usda: 'Nuts, walnuts, english', de: 'Walnüsse' },
  { usda: 'Nuts, cashew nuts, raw', de: 'Cashewkerne' },
  { usda: 'Nuts, hazelnuts or filberts', de: 'Haselnüsse' },
  { usda: 'Peanuts, all types, raw', de: 'Erdnüsse' },
  {
    usda: 'Peanut butter, smooth style, without salt',
    de: 'Erdnussbutter',
    portions: [{ label: '1 EL', grams: 16 }],
  },
  { usda: 'Seeds, chia seeds, dried', de: 'Chiasamen' },
  { usda: 'Seeds, flaxseed', de: 'Leinsamen' },
  { usda: 'Seeds, sunflower seed kernels, dried', de: 'Sonnenblumenkerne' },
  // Süßes, Getränke
  { usda: 'Sugars, granulated', de: 'Zucker', portions: [{ label: '1 TL', grams: 4 }] },
  { usda: 'Honey', de: 'Honig', portions: [{ label: '1 TL', grams: 7 }] },
  { usda: 'Chocolate, dark, 70-85% cacao solids', de: 'Zartbitterschokolade (70–85 %)' },
  { usda: 'Candies, milk chocolate', de: 'Vollmilchschokolade' },
  { usda: 'Ice creams, vanilla', de: 'Vanilleeis' },
  {
    usda: 'Beverages, coffee, brewed, prepared with tap water',
    de: 'Kaffee, schwarz',
    liquid: true,
  },
  {
    usda: 'Beverages, tea, black, brewed, prepared with tap water',
    de: 'Schwarztee',
    liquid: true,
  },
  { usda: 'Beverages, carbonated, cola, contains caffeine', de: 'Cola', liquid: true },
  { usda: 'Orange juice, raw', de: 'Orangensaft, frisch gepresst', liquid: true },
  {
    usda: 'Alcoholic beverage, beer, regular, all',
    de: 'Bier',
    liquid: true,
    portions: [{ label: '1 Flasche (0,5 l)', grams: 500 }],
  },
  {
    usda: 'Alcoholic beverage, wine, table, red',
    de: 'Rotwein',
    liquid: true,
    portions: [{ label: '1 Glas', grams: 150 }],
  },
  {
    usda: 'Alcoholic beverage, wine, table, white',
    de: 'Weißwein',
    liquid: true,
    portions: [{ label: '1 Glas', grams: 150 }],
  },
];
