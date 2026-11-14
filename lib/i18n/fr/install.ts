import type en from "../en/install";
const install: Record<keyof typeof en, string> = {
  "install.nav": "App",
  "install.title": "Application & notifications",
  "install.eyebrow": "Téléphone & tablette",
  "install.intro": "Installez l'outil comme application sur votre téléphone (sans store, sans fichier à télécharger) – vous recevez alors des notifications push pour tout ce que vous choisissez ci-dessous.",
  "install.button": "Installer maintenant",
  "install.installed": "L'application est installée sur cet appareil.",
  "install.android.title": "Android (Chrome)",
  "install.android.1": "Ouvrez {url} dans Chrome et connectez-vous.",
  "install.android.2": "Menu ⋮ (en haut à droite) → « Installer l'application » (parfois « Ajouter à l'écran d'accueil »).",
  "install.android.3": "Ouvrez l'outil depuis la nouvelle icône.",
  "install.ios.title": "iPhone / iPad (Safari, iOS 16.4 ou plus récent)",
  "install.ios.1": "Ouvrez {url} dans Safari et connectez-vous.",
  "install.ios.2": "Partager (carré avec flèche) → « Sur l'écran d'accueil » → « Ajouter ».",
  "install.ios.3": "Ouvrez l'outil depuis la nouvelle icône – les notifications push ne fonctionnent que là, pas dans l'onglet Safari normal.",
  "install.push": "Ouvrez l'outil depuis l'icône de l'application sur votre téléphone (iPhone : uniquement là), puis touchez « Activer sur cet appareil ». À faire sur chaque téléphone ou navigateur.",
};
export default install;
