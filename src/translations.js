export const LANGUAGES = ['en', 'fr'];

export const translations = {
  en: {
    languageName: 'English',
    eyebrow: 'Company sale',
    title: 'Order details',
    nameLabel: 'Name',
    companyLabel: 'Company',
    selectCompany: 'Select a company',
    loadingMenu: 'Loading menu…',
    loadError: 'Could not load the menu. Please refresh the page.',
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
    loadingMenu: 'Chargement du menu…',
    loadError: 'Impossible de charger le menu. Veuillez actualiser la page.',
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
