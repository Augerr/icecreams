export const LANGUAGES = ['en', 'fr'];

export const PRODUCT_TRANSLATIONS = {
  vanilla_cup: {
    en: { name: 'Vanilla Cup', note: 'Classic vanilla, single-serve cup' },
    fr: { name: 'Coupe vanille', note: 'Vanille classique, format individuel' }
  },
  chocolate_cup: {
    en: { name: 'Chocolate Cup', note: 'Rich chocolate, single-serve cup' },
    fr: { name: 'Coupe chocolat', note: 'Chocolat riche, format individuel' }
  },
  strawberry_cup: {
    en: { name: 'Strawberry Cup', note: 'Strawberry cream, single-serve cup' },
    fr: { name: 'Coupe fraise', note: 'Crème à la fraise, format individuel' }
  },
  mint_chip: {
    en: { name: 'Mint Chip', note: 'Mint ice cream with chocolate chips' },
    fr: { name: 'Menthe et brisures', note: 'Crème glacée à la menthe avec brisures de chocolat' }
  },
  sandwich: {
    en: { name: 'Ice Cream Sandwich', note: 'Vanilla center with cookie wafers' },
    fr: { name: 'Sandwich glacé', note: 'Centre à la vanille entre deux gaufrettes' }
  },
  fudge_bar: {
    en: { name: 'Fudge Bar', note: 'Chocolate fudge frozen bar' },
    fr: { name: 'Barre fudge', note: 'Barre glacée au fudge au chocolat' }
  }
};

export const translations = {
  en: {
    languageName: 'English',
    eyebrow: 'Company sale',
    title: 'Order details',
    nameLabel: 'Name',
    companyLabel: 'Company',
    selectCompany: 'Select a company',
    menuLabel: 'Ice cream menu',
    itemHeading: 'Item',
    priceHeading: 'Price',
    qtyHeading: 'Qty',
    lineHeading: 'Line',
    decreaseLabel: (name) => `Decrease ${name}`,
    increaseLabel: (name) => `Increase ${name}`,
    quantityLabel: (name) => `${name} quantity`,
    reset: 'Reset',
    submit: 'Submit order',
    orderSummary: 'Order Summary',
    emptyState: 'No items selected yet.',
    itemsCount: (count) => `${count} item${count === 1 ? '' : 's'}`,
    incompleteError: 'Add your name, company, and at least one item.',
    saving: 'Saving order...',
    success: 'Order saved. Thank you!',
    genericError: 'Could not save the order.'
  },
  fr: {
    languageName: 'Français',
    eyebrow: 'Vente d’entreprise',
    title: 'Détails de la commande',
    nameLabel: 'Nom',
    companyLabel: 'Entreprise',
    selectCompany: 'Choisir une entreprise',
    menuLabel: 'Menu de crème glacée',
    itemHeading: 'Article',
    priceHeading: 'Prix',
    qtyHeading: 'Qté',
    lineHeading: 'Total',
    decreaseLabel: (name) => `Diminuer ${name}`,
    increaseLabel: (name) => `Augmenter ${name}`,
    quantityLabel: (name) => `Quantité de ${name}`,
    reset: 'Réinitialiser',
    submit: 'Envoyer la commande',
    orderSummary: 'Résumé de la commande',
    emptyState: 'Aucun article sélectionné pour le moment.',
    itemsCount: (count) => `${count} article${count === 1 ? '' : 's'}`,
    incompleteError: 'Ajoutez votre nom, votre entreprise et au moins un article.',
    saving: 'Enregistrement de la commande...',
    success: 'Commande enregistrée. Merci!',
    genericError: 'Impossible d’enregistrer la commande.'
  }
};

export function detectInitialLanguage() {
  const stored = window.localStorage.getItem('language');
  if (LANGUAGES.includes(stored)) {
    return stored;
  }

  return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}
