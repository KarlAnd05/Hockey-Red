(function () {
  'use strict';

  const isFrench = /^\/fr(?:\/|$)/.test(window.location.pathname);

  const translations = {
    'Skip to content': 'Passer au contenu',
    Home: 'Accueil',
    About: 'À propos',
    'About · Lebanon Hockey': 'À propos · Lebanon Hockey',
    'Our Teams': 'Nos équipes',
    News: 'Actualités',
    Membership: 'Adhésion',
    Events: 'Événements',
    Sponsors: 'Commanditaires',
    Donation: 'Faire un don',
    Store: 'Boutique',
    'Sign In': 'Connexion',
    'Sign in': 'Se connecter',
    'Create account': 'Créer un compte',
    'Create Account': 'Créer un compte',
    'Your account': 'Votre compte',
    'Lebanon Hockey home': 'Accueil Lebanon Hockey',
    'All products': 'Tous les produits',
    Cart: 'Panier',
    Donate: 'Faire un don',
    Contact: 'Contact',
    'Contact Us': 'Nous joindre',
    'Get in Touch': 'Nous joindre',
    'Send message': 'Envoyer le message',
    Send: 'Envoyer',
    'First name': 'Prénom',
    'Last name': 'Nom',
    'Middle name': 'Deuxième prénom',
    Email: 'Courriel',
    Phone: 'Téléphone',
    Message: 'Message',
    Password: 'Mot de passe',
    'Confirm password': 'Confirmer le mot de passe',
    'Confirm new password': 'Confirmer le nouveau mot de passe',
    'Current password': 'Mot de passe actuel',
    'New password': 'Nouveau mot de passe',
    'Save changes': 'Enregistrer les modifications',
    'Save new password': 'Enregistrer le nouveau mot de passe',
    'Update password': 'Mettre à jour le mot de passe',
    'Forgot your password?': 'Mot de passe oublié?',
    'New here?': 'Nouveau ici?',
    'Already have an account?': 'Vous avez déjà un compte?',
    'Remembered it?': 'Vous vous en souvenez?',
    'Back to sign in': 'Retour à la connexion',
    'Send reset link': 'Envoyer le lien de réinitialisation',
    'Sign out': 'Déconnexion',
    'Order history': 'Historique des commandes',
    Profile: 'Profil',
    Security: 'Sécurité',
    'Admin area': 'Espace admin',
    Programs: 'Programmes',
    Federation: 'Fédération',
    'Privacy Policy': 'Politique de confidentialité',
    'Cookie Policy': 'Politique relative aux témoins',
    'Refunds & Returns': 'Remboursements et retours',
    'Lebanon Hockey Building a fast, proud hockey community through programs, camps, events, and partnerships across Canada and Lebanon.':
      'Lebanon Hockey bâtit une communauté de hockey dynamique et fière grâce à des programmes, des camps, des événements et des partenariats au Canada et au Liban.',
    '1418 Victoria Avenue, Suite 110, Greenfield Park, Quebec J4V 1M1':
      '1418, avenue Victoria, bureau 110, Greenfield Park (Québec) J4V 1M1',
    'All rights reserved.': 'Tous droits réservés.',
    'Reg. no. 00418': 'No d’enregistrement 00418',
    'Lebanese Ice Hockey Federation': 'Fédération libanaise de hockey sur glace',
    'About Us': 'À propos de nous',
    'Founded to advance hockey opportunities for Lebanese players worldwide and give Lebanon a voice on the international ice hockey stage.':
      'Fondée pour développer les possibilités de hockey pour les joueurs libanais partout dans le monde et faire entendre la voix du Liban sur la scène internationale du hockey sur glace.',
    "Where We're Headed": 'Notre vision',
    'Building for the future': 'Bâtir l’avenir',
    "Recognized by Lebanon's Ministry of Sports, the IIHF, and the Lebanese Olympic Committee, the federation is working toward a permanent home for the sport in Lebanon.":
      'Reconnue par le ministère des Sports du Liban, l’IIHF et le Comité olympique libanais, la fédération travaille à établir un lieu permanent pour ce sport au Liban.',
    'Founded May 2018': 'Fondée en mai 2018',
    'Ministry of Sports Decree, 2018 (renewed 2022)': 'Décret du ministère des Sports, 2018 (renouvelé en 2022)',
    'IIHF Associate Member since 2019': 'Membre associé de l’IIHF depuis 2019',
    'Lebanese Olympic Committee Member since 2020': 'Membre du Comité olympique libanais depuis 2020',
    'Federation Leadership': 'Direction de la fédération',
    'Board & Management': 'Conseil et direction',
    President: 'Président',
    'Vice President, Hockey Operations': 'Vice-président, opérations hockey',
    'General Secretary': 'Secrétaire général',
    "Director, Women's Development": 'Directrice du développement du hockey féminin',
    'Director, Accounting': 'Directrice de la comptabilité',
    'Director, Technical & Ice Rink Project': 'Directeur des projets techniques et de patinoire',
    'Director, Public Relations': 'Directrice des relations publiques',
    'Director, Legal Affairs': 'Directeur des affaires juridiques',
    Gold: 'Or',
    Bronze: 'Bronze',
    "Men's National Team": 'Équipe nationale masculine',
    "Women's National Team": 'Équipe nationale féminine',
    'On The Ice': 'Sur la glace',
    'International Achievements': 'Réalisations internationales',
    'Get Involved': 'Participez',
    'Be part of the story.': 'Faites partie de l’histoire.',
    'Reach us at our Greenfield Park, Quebec headquarters or by email to learn more about the federation.':
      'Communiquez avec nous à notre siège de Greenfield Park, au Québec, ou par courriel pour en savoir plus sur la fédération.',
    'Recognised By': 'Reconnu par',
    'Recognised by': 'Reconnu par',
    'A seat at the international table': 'Une place sur la scène internationale',
    'Every claim here is a matter of public record.': 'Chaque affirmation présentée ici est vérifiable dans les dossiers publics.',
    'On The Calendar': 'À l’affiche',
    'Federation Events': 'Événements de la fédération',
    'Series, tournaments, and camps happening across Canada and Lebanon.':
      'Séries, tournois et camps organisés au Canada et au Liban.',
    'Competitive sessions and federation events for players, families, and supporters.':
      'Séances compétitives et événements de la fédération pour les joueurs, les familles et les partisans.',
    'Learn More': 'En savoir plus',
    'See the schedule': 'Voir l’horaire',
    "What's On": 'À venir',
    'Programs and schedule': 'Programmes et calendrier',
    'Camps, sessions, tryouts and tournaments, soonest first.':
      'Camps, séances, essais et tournois, en ordre chronologique.',
    "Don't Miss Out": 'Ne manquez rien',
    'Follow the calendar.': 'Suivez le calendrier.',
    'Reach out to be notified as new dates and tournaments are announced.':
      'Écrivez-nous pour être informé de l’annonce de nouvelles dates et de nouveaux tournois.',
    'Four programs carrying Lebanon onto the ice. Pick a team to see its roster.':
      'Quatre programmes qui font rayonner le Liban sur la glace. Choisissez une équipe pour consulter son alignement.',
    'Play For Lebanon': 'Jouez pour le Liban',
    'Eligible to wear the cedar?': 'Admissible à représenter le Liban?',
    'Register your interest and the federation will be in touch about tryouts and camps.':
      'Manifestez votre intérêt et la fédération communiquera avec vous au sujet des essais et des camps.',
    Register: 'S’inscrire',
    'Federation Updates': 'Nouvelles de la fédération',
    Newsroom: 'Actualités',
    'Announcements from the Lebanese Ice Hockey Federation.':
      'Annonces de la Fédération libanaise de hockey sur glace.',
    'Stay Connected': 'Restez en contact',
    'More stories soon.': 'D’autres nouvelles bientôt.',
    "Reach out if you'd like federation news delivered directly.":
      'Écrivez-nous si vous souhaitez recevoir directement les nouvelles de la fédération.',
    'Join The Thrill': 'Vivez la passion',
    'Join the thrill.': 'Vivez la passion.',
    'Join The': 'Vivez la',
    Thrill: 'passion',
    'Become part of a federation community that connects athletes, families, volunteers, sponsors, and supporters.':
      'Joignez-vous à une communauté qui rassemble les athlètes, les familles, les bénévoles, les commanditaires et les partisans.',
    'Membership Tiers': 'Types d’adhésion',
    'Pick your role': 'Choisissez votre rôle',
    'Board Member / Manager / Coach': 'Membre du conseil / gestionnaire / entraîneur',
    'For federation board members, team managers, and coaching staff.':
      'Pour les membres du conseil, les gestionnaires d’équipe et le personnel d’entraîneurs de la fédération.',
    Player: 'Joueur',
    'For registered players on federation rosters and programs.':
      'Pour les joueurs inscrits aux alignements et aux programmes de la fédération.',
    'Fan / Supporter': 'Partisan / soutien',
    'For families, fans, and supporters of Lebanon Hockey.':
      'Pour les familles, les partisans et les personnes qui soutiennent Lebanon Hockey.',
    'How It Works': 'Comment ça fonctionne',
    'Three simple steps': 'Trois étapes simples',
    'Register below and we will be in touch. Players are asked for a few eligibility details the IIHF requires; supporters are not.':
      'Inscrivez-vous ci-dessous et nous communiquerons avec vous. Quelques renseignements d’admissibilité exigés par l’IIHF sont demandés aux joueurs, mais pas aux partisans.',
    'Start Your Registration': 'Commencer l’inscription',
    Registration: 'Inscription',
    'LIHF registration form': 'Formulaire d’inscription de la F.L.H.G.',
    'All players must complete this form. It takes a couple of minutes.':
      'Tous les joueurs doivent remplir ce formulaire. Cela ne prend que quelques minutes.',
    'Membership type': 'Type d’adhésion',
    'Eligibility and playing details': 'Admissibilité et renseignements sur le jeu',
    'City of residence': 'Ville de résidence',
    'Your name': 'Votre nom',
    'Date of birth': 'Date de naissance',
    Position: 'Position',
    Shoots: 'Lance de',
    Forward: 'Attaquant',
    Defence: 'Défenseur',
    Goaltender: 'Gardien de but',
    Left: 'Gauche',
    Right: 'Droite',
    'Height (cm)': 'Taille (cm)',
    'Weight (kg)': 'Poids (kg)',
    'Place of birth (city)': 'Lieu de naissance (ville)',
    'Country of birth': 'Pays de naissance',
    Citizenship: 'Citoyenneté',
    'Second citizenship': 'Deuxième citoyenneté',
    'Citizenship of father': 'Citoyenneté du père',
    'Citizenship of mother': 'Citoyenneté de la mère',
    '(optional)': '(facultatif)',
    'Support The Mission': 'Soutenez la mission',
    'Support the Mission': 'Soutenez la mission',
    'Support the Team': 'Soutenez l’équipe',
    'Become A Partner': 'Devenez partenaire',
    'Become a partner': 'Devenez partenaire',
    'Official partners help grow Lebanese ice hockey through events, athlete support, community programs, and international visibility.':
      'Les partenaires officiels contribuent au développement du hockey sur glace libanais par les événements, le soutien aux athlètes, les programmes communautaires et le rayonnement international.',
    'Public Record': 'Dossiers publics',
    'The Lebanese Ice Hockey Federation is the body that gives Lebanon a seat at the international table. Every claim below is a matter of public record.':
      'La Fédération libanaise de hockey sur glace donne au Liban une place sur la scène internationale. Chaque affirmation ci-dessous est vérifiable dans les dossiers publics.',
    'Ministry of Sports Decree': 'Décret du ministère des Sports',
    'Renewed 2022': 'Renouvelé en 2022',
    'IIHF Associate Member': 'Membre associé de l’IIHF',
    'Int. Ice Hockey Federation': 'Fédération internationale de hockey sur glace',
    'Lebanese Olympic Committee': 'Comité olympique libanais',
    'Member federation': 'Fédération membre',
    'Who you would be working with': 'Avec qui vous travaillerez',
    'The federation’s board, by office.': 'Le conseil de la fédération, par fonction.',
    'Partnership Tiers': 'Niveaux de partenariat',
    'Current partners': 'Partenaires actuels',
    'Organisations already backing the federation.': 'Les organisations qui soutiennent déjà la fédération.',
    'In Action': 'En action',
    'Federation moments': 'Moments de la fédération',
    'Ready To Partner?': 'Prêt à devenir partenaire?',
    "Let's grow the game together.": 'Faisons grandir le hockey ensemble.',
    'Reach out to discuss partnership tiers, or support a player directly with a donation.':
      'Communiquez avec nous pour discuter des niveaux de partenariat ou soutenir directement un joueur par un don.',
    'Partner With Us': 'Devenez notre partenaire',
    'Make a Donation': 'Faire un don',
    'Fuel The Mission': 'Faites avancer la mission',
    'Support The Team': 'Soutenez l’équipe',
    'Your donation directly supports players as they train, travel, and represent Lebanon on the ice.':
      'Votre don soutient directement les joueurs dans leur entraînement, leurs déplacements et leur représentation du Liban sur la glace.',
    'Ways To Give': 'Façons de donner',
    'One-time or monthly': 'Une fois ou chaque mois',
    'How often': 'Fréquence',
    'One time': 'Une fois',
    'Every month': 'Chaque mois',
    Amount: 'Montant',
    'Or enter your own amount': 'Ou saisissez le montant de votre choix',
    'Team Store': 'Boutique de l’équipe',
    'Wear The Cedars': 'Portez les cèdres',
    'Official Lebanon Hockey merchandise. Every purchase supports the federation.':
      'Articles officiels de Lebanon Hockey. Chaque achat soutient la fédération.',
    'Filters': 'Filtres',
    Featured: 'En vedette',
    'Price: low to high': 'Prix : du plus bas au plus élevé',
    'Price: high to low': 'Prix : du plus élevé au plus bas',
    'Name: A to Z': 'Nom : de A à Z',
    'Name: Z to A': 'Nom : de Z à A',
    Newest: 'Plus récents',
    Category: 'Catégorie',
    Price: 'Prix',
    Availability: 'Disponibilité',
    'In stock only': 'En stock seulement',
    'Clear filters': 'Effacer les filtres',
    'Your Cart': 'Votre panier',
    Checkout: 'Paiement',
    'Privacy': 'Confidentialité',
    'Cookies': 'Témoins',
    'Legal': 'Renseignements juridiques',
    'Last updated: 6 September 2026': 'Dernière mise à jour : 6 septembre 2026',
    'Get In Touch': 'Nous joindre',
    'Questions about joining, playing, sponsoring or ordering — send them here.':
      'Une question sur l’adhésion, le hockey, le parrainage ou une commande? Écrivez-nous ici.',
    'Register your interest': 'Manifester votre intérêt',
    'Partnership options': 'Options de partenariat',
    'Send us a message': 'Envoyez-nous un message',
    'Members': 'Membres',
    'Access your orders, invoices, and account details.':
      'Consultez vos commandes, vos factures et les renseignements de votre compte.',
    'Track your orders, download invoices, and check out faster.':
      'Suivez vos commandes, téléchargez vos factures et accélérez le paiement.',
    'Forgot Password': 'Mot de passe oublié',
    'Enter your email and we will send you a link to choose a new password. The link is valid for one hour.':
      'Saisissez votre courriel et nous vous enverrons un lien pour choisir un nouveau mot de passe. Le lien est valide pendant une heure.',
    'New Password': 'Nouveau mot de passe',
    'Choose a new password for your account. You will be signed out everywhere else.':
      'Choisissez un nouveau mot de passe pour votre compte. Vous serez déconnecté de tous vos appareils.',
    'Password updated. Redirecting you to sign in...':
      'Mot de passe mis à jour. Redirection vers la page de connexion…',
    'Enter a valid email address, like name@example.com.':
      'Saisissez une adresse courriel valide, par exemple nom@exemple.com.',
    'Please check': 'Veuillez vérifier',
    'This field is required.': 'Ce champ est obligatoire.',
    'Choose a size first.': 'Choisissez d’abord une taille.',
    'Add to cart': 'Ajouter au panier',
    'Adding...': 'Ajout en cours…',
    Added: 'Ajouté',
    'Product not found': 'Produit introuvable',
    'Back to the store': 'Retour à la boutique',
    'Check your size before you order': 'Vérifiez votre taille avant de commander',
    'Youth sizes': 'Tailles jeunesse',
    'Adult sizes': 'Tailles adultes',
    'Still unsure, or buying for someone else? Email':
      'Vous hésitez encore ou vous achetez pour quelqu’un d’autre? Écrivez à',
    'Ships from': 'Expédié de',
    Delivery: 'Livraison',
    Supports: 'Soutient',
    Returns: 'Retours',
    'All sales final — faulty or incorrect items always replaced':
      'Vente finale — les articles défectueux ou incorrects sont toujours remplacés',
    'All sales are final. Anything faulty, damaged or wrong is always put right.':
      'Toutes les ventes sont finales. Tout article défectueux, endommagé ou incorrect sera remplacé ou corrigé.',
    'one-time or monthly donation': 'don ponctuel ou mensuel',
    'Unable to load': 'Impossible de charger',
    'Complete all required fields.': 'Veuillez remplir tous les champs obligatoires.',
    'Please check  fields above before continuing.': 'Veuillez vérifier les champs ci-dessus avant de continuer.',
    'Choose a membership type before continuing.': 'Choisissez un type d’adhésion avant de continuer.',
    'The two passwords do not match.': 'Les deux mots de passe ne correspondent pas.',
    'No products found': 'Aucun produit trouvé',
    'Your cart is empty': 'Votre panier est vide',
    'Continue shopping': 'Continuer vos achats',
    'Proceed to checkout': 'Passer au paiement',
    'Remove': 'Supprimer',
    'Update': 'Mettre à jour',
    'Continue': 'Continuer',
    'Save': 'Enregistrer',
    'Cancel': 'Annuler',
    'Loading...': 'Chargement…',
    'Loading': 'Chargement',
    'Could not load the news': 'Impossible de charger les nouvelles',
    'Federation announcements will appear here.': 'Les annonces de la fédération apparaîtront ici.',
    'Back to the site': 'Retour au site',
    'Every item sold by the Lebanese Ice Hockey Federation is non-refundable and non-returnable. We do not accept returns for change of mind, for the wrong size, or because an item is no longer wanted.':
      'Tous les articles vendus par la Fédération libanaise de hockey sur glace sont non remboursables et non retournables. Les retours ne sont pas acceptés en cas de changement d’idée, de mauvaise taille ou si l’article n’est plus désiré.',
    'In short: all sales are final. Orders cannot be returned, exchanged or refunded once they are placed. The one exception is an item that arrives faulty, damaged or not what you ordered — we put that right.':
      'En bref : toutes les ventes sont finales. Une fois la commande passée, les articles ne peuvent être retournés, échangés ou remboursés. La seule exception concerne un article défectueux, endommagé ou différent de celui commandé : nous corrigerons la situation.',
    'A manufacturing fault that shows up later is still a fault. Tell us and we will look at it.':
      'Un défaut de fabrication qui apparaît plus tard demeure un défaut. Faites-le-nous savoir et nous examinerons la situation.',
    'An order can only be cancelled if production has not started. Email us as soon as possible with your order number. Once an item has gone into production it cannot be cancelled.':
      'Une commande ne peut être annulée que si la production n’a pas commencé. Écrivez-nous dès que possible en indiquant votre numéro de commande. Une fois la production commencée, l’annulation n’est plus possible.',
    'Donations and membership fees are also non-refundable. A monthly donation can be stopped at any time using the link in your confirmation email; stopping it prevents future charges and does not refund past ones.':
      'Les dons et les frais d’adhésion sont également non remboursables. Un don mensuel peut être interrompu en tout temps à l’aide du lien dans le courriel de confirmation; cela empêche les frais futurs, mais ne rembourse pas les dons déjà faits.',
    'Something wrong with your order? Email info@lebanonhockey.com with your order number. A faulty, damaged or incorrect item is always put right — the policy above is about change of mind, not about leaving you with something broken.':
      'Un problème avec votre commande? Écrivez à info@lebanonhockey.com en indiquant votre numéro de commande. Tout article défectueux, endommagé ou incorrect sera remplacé ou corrigé : la politique ci-dessus concerne les changements d’idée et ne vise pas à vous laisser avec un article brisé.',
    'We use exactly one cookie, and only when you actually need it.':
      'Nous utilisons un seul témoin, uniquement lorsque vous en avez réellement besoin.',
    'A cookie is a small file a website asks your browser to store. This page lists every cookie Lebanon Hockey uses and what each one does.':
      'Un témoin est un petit fichier qu’un site demande à votre navigateur d’enregistrer. Cette page présente tous les témoins utilisés par Lebanon Hockey et leur fonction.',
    'We use one cookie, and no tracking of any kind. There are no analytics cookies, no advertising cookies, no social media pixels, and no third-party scripts on this site.':
      'Nous utilisons un seul témoin et aucun outil de suivi. Ce site n’utilise aucun témoin d’analyse ou de publicité, aucun pixel de réseau social et aucun script tiers.',
    'The cookie holds a random identifier only. It contains no personal information, and it cannot be read by JavaScript or by any other website.':
      'Le témoin contient uniquement un identifiant aléatoire. Il ne contient aucun renseignement personnel et ne peut être lu ni par JavaScript ni par un autre site Web.',
    'We have also deliberately delayed it: the cookie is issued only at the moment you do something that needs it. If you browse the site and never use the cart or sign in, no cookie is ever set.':
      'Nous avons aussi choisi de retarder son installation : le témoin est créé uniquement au moment où vous utilisez une fonction qui en a besoin. Si vous consultez le site sans utiliser le panier ni vous connecter, aucun témoin n’est installé.',
    'If we ever add analytics or any other non-essential cookie, we will ask for your consent first and this page will change.':
      'Si nous ajoutons un jour des outils d’analyse ou tout autre témoin non essentiel, nous demanderons d’abord votre consentement et mettrons cette page à jour.',
    'Chat messages are kept so the federation can answer you and refer back to what was asked. They are held for up to 12 months, the same as messages sent through the contact form, and then deleted.':
      'Les messages de clavardage sont conservés afin que la fédération puisse vous répondre et consulter vos questions. Ils sont gardés jusqu’à 12 mois, tout comme les messages envoyés par le formulaire de contact, puis supprimés.',
    'If the cookies we use change, we will update this page and the date shown at the top.':
      'Si les témoins que nous utilisons changent, nous mettrons cette page à jour ainsi que la date indiquée en haut.',
    'Questions about this policy? Email info@lebanonhockey.com. See also our Privacy Policy.':
      'Des questions sur cette politique? Écrivez à info@lebanonhockey.com. Consultez également notre politique de confidentialité.',
    'This policy explains how the Lebanese Ice Hockey Federation ("Lebanon Hockey", "we", "us") handles personal information collected through lebanonhockey.com and its online shop.':
      'La présente politique explique comment la Fédération libanaise de hockey sur glace (« Lebanon Hockey », « nous ») traite les renseignements personnels recueillis sur lebanonhockey.com et dans sa boutique en ligne.',
    "We are based in Quebec, Canada. We follow Quebec's Act respecting the protection of personal information in the private sector (as amended by Law 25) and Canada's Personal Information Protection and Electronic Documents Act (PIPEDA).":
      'Nous sommes établis au Québec, au Canada. Nous respectons la Loi sur la protection des renseignements personnels dans le secteur privé du Québec (modifiée par la Loi 25) et la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE) du Canada.',
    'The federation is responsible for the personal information under its control. Our Privacy Officer can be reached at info@lebanonhockey.com or by post at 1418 Victoria Avenue, Suite 110, Greenfield Park, Quebec J4V 1M1, Canada.':
      'La fédération est responsable des renseignements personnels sous son contrôle. Vous pouvez joindre notre responsable de la protection des renseignements personnels à info@lebanonhockey.com ou par courrier au 1418, avenue Victoria, bureau 110, Greenfield Park (Québec) J4V 1M1, Canada.',
    "We never see your card details. Payments are handled entirely on Stripe's own hosted checkout page. Card numbers, expiry dates, and security codes are never sent to, processed by, or stored on our servers.":
      'Nous ne voyons jamais les données de votre carte. Les paiements sont entièrement traités sur la page de paiement hébergée par Stripe. Les numéros de carte, dates d’expiration et codes de sécurité ne sont jamais transmis à nos serveurs, traités par ceux-ci ni stockés sur ceux-ci.',
    'We use a small number of service providers, and only for the purposes below:':
      'Nous faisons appel à un nombre limité de fournisseurs de services, uniquement aux fins indiquées ci-dessous :',
    'We may also disclose information where required by law, or to establish or defend a legal claim.':
      'Nous pouvons également communiquer des renseignements lorsque la loi l’exige ou pour établir ou défendre une réclamation juridique.',
    'If a confidentiality incident occurs that presents a risk of serious injury, we will notify you and the Commission d’accès à l’information as Law 25 requires, and record it in our incident register.':
      'Si un incident de confidentialité présente un risque de préjudice sérieux, nous vous en aviserons ainsi que la Commission d’accès à l’information, conformément à la Loi 25, et le consignerons dans notre registre des incidents.',
    'Write to info@lebanonhockey.com and we will respond within 30 days. If you are not satisfied with our answer, you may complain to the Commission d’accès à l’information du Québec or to the Office of the Privacy Commissioner of Canada.':
      'Écrivez à info@lebanonhockey.com et nous vous répondrons dans les 30 jours. Si notre réponse ne vous satisfait pas, vous pouvez porter plainte auprès de la Commission d’accès à l’information du Québec ou du Commissariat à la protection de la vie privée du Canada.',
    'We do not make decisions about you by automated means, and we do not build profiles of you.':
      'Nous ne prenons aucune décision à votre sujet par des moyens automatisés et ne créons aucun profil à votre sujet.',
    "Our shop is intended for adults. Youth programs are registered by a parent or guardian, who provides any information about a minor and consents to its use on the child's behalf.":
      'Notre boutique s’adresse aux adultes. Un parent ou tuteur inscrit les jeunes aux programmes, fournit les renseignements concernant le mineur et consent à leur utilisation en son nom.',
    'If we change this policy we will update the date at the top of this page, and for significant changes we will say so on the site.':
      'Si nous modifions cette politique, nous mettrons à jour la date au haut de cette page et annoncerons les changements importants sur le site.',
    'Questions? Email info@lebanonhockey.com and a person will answer you.':
      'Des questions? Écrivez à info@lebanonhockey.com et une personne vous répondra.',
    'Home · Lebanon Hockey': 'Accueil · Lebanon Hockey',
    'Membership · Lebanon Hockey': 'Adhésion · Lebanon Hockey',
    'News · Lebanon Hockey': 'Actualités · Lebanon Hockey',
    'Events · Lebanon Hockey': 'Événements · Lebanon Hockey',
    'Sponsors · Lebanon Hockey': 'Commanditaires · Lebanon Hockey',
    'Donation · Lebanon Hockey': 'Faire un don · Lebanon Hockey',
    'Donate · Lebanon Hockey': 'Faire un don · Lebanon Hockey',
    'Contact · Lebanon Hockey': 'Contact · Lebanon Hockey',
    'Contact Us · Lebanon Hockey': 'Nous joindre · Lebanon Hockey',
    'Teams · Lebanon Hockey': 'Équipes · Lebanon Hockey',
    'Our Teams · Lebanon Hockey': 'Nos équipes · Lebanon Hockey',
    'Store · Lebanon Hockey': 'Boutique · Lebanon Hockey',
    'Sign In · Lebanon Hockey': 'Connexion · Lebanon Hockey',
    'Create Account · Lebanon Hockey': 'Créer un compte · Lebanon Hockey',
    'Account · Lebanon Hockey': 'Compte · Lebanon Hockey',
    'Your Account · Lebanon Hockey': 'Votre compte · Lebanon Hockey',
    'Cart · Lebanon Hockey': 'Panier · Lebanon Hockey',
    'Checkout · Lebanon Hockey': 'Paiement · Lebanon Hockey',
    'Order Confirmation · Lebanon Hockey': 'Confirmation de commande · Lebanon Hockey',
    'Product · Lebanon Hockey': 'Produit · Lebanon Hockey',
    'Reset Your Password · Lebanon Hockey': 'Réinitialiser votre mot de passe · Lebanon Hockey',
    'Choose a New Password · Lebanon Hockey': 'Choisir un nouveau mot de passe · Lebanon Hockey',
    'Privacy Policy · Lebanon Hockey': 'Politique de confidentialité · Lebanon Hockey',
    'Cookie Policy · Lebanon Hockey': 'Politique relative aux témoins · Lebanon Hockey',
    'Refunds & Returns · Lebanon Hockey': 'Remboursements et retours · Lebanon Hockey',
    'The body that gives Lebanon a seat at the international ice hockey table — recognised by the state, by the world federation, and by the Olympic movement.':
      'L’organisme qui donne au Liban une place sur la scène internationale du hockey sur glace, reconnu par l’État, la fédération mondiale et le mouvement olympique.',
    'View Events': 'Voir les événements',
    'View all events': 'Voir tous les événements',
    'View All Events': 'Voir tous les événements',
    'Federation series, tournaments, and camps happening across Canada and Lebanon.':
      'Séries, tournois et camps de la fédération organisés au Canada et au Liban.',
    'Training, development, and community for the next generation of players.':
      'Entraînement, développement et communauté pour la prochaine génération de joueurs.',
    "Men's, Women's, and Youth Development": 'Développement masculin, féminin et jeunesse',
    'Lebanon Hockey supports players through organized programs, skill-building opportunities, and a connected federation network.':
      'Lebanon Hockey soutient les joueurs grâce à des programmes organisés, des occasions de perfectionnement et un réseau fédératif solidaire.',
    'From the ice and the rink-side community': 'De la glace à la communauté autour de la patinoire',
    'Join the Thrill.': 'Vivez la passion.',
    'Ask about membership': 'Renseignez-vous sur l’adhésion',
    'Ask About Membership': 'Renseignez-vous sur l’adhésion',
    'Explore partnership': 'Découvrir les partenariats',
    'Explore Partnership': 'Découvrir les partenariats',
    'LEBANON HOCKEY': 'LEBANON HOCKEY',
    'First Name': 'Prénom',
    'Last Name': 'Nom',
    'Send Message': 'Envoyer le message',
    'No card payments yet': 'Paiement par carte non disponible pour le moment',
    'The online store is not taking card payments yet.':
      'La boutique en ligne n’accepte pas encore les paiements par carte.',
    'We cannot take card donations yet.': 'Les dons par carte ne sont pas encore disponibles.',
    'Everything here is real and in stock — we are finishing the payment setup. To order in the meantime, email us what you want and your size and we will invoice you directly.':
      'Tous les articles présentés sont disponibles en stock. Nous terminons la configuration des paiements. Pour commander entre-temps, écrivez-nous en précisant l’article souhaité et la taille; nous vous enverrons une facture.',
    'Email your order': 'Envoyez votre commande par courriel',
    'Support us instead': 'Soutenez-nous autrement',
    'Every jersey is made to order. We work hard to get them to you, and we will always give you an honest delivery time-frame rather than a promise we cannot keep.':
      'Chaque chandail est fabriqué sur commande. Nous faisons tout notre possible pour vous le livrer et vous indiquerons un délai réaliste plutôt que de faire une promesse que nous ne pouvons tenir.',
    'Choose your jersey type, colour and size on each product page. If you need anything clarified before ordering, email sales@lebanonhockey.com — thank you for your trust.':
      'Choisissez le type, la couleur et la taille du chandail sur sa page produit. Pour toute question avant de commander, écrivez à sales@lebanonhockey.com. Merci de votre confiance.',
    'Prefer to pay another way? Interac e-Transfer within Canada to sales@lebanonhockey.com, or PayPal from outside Canada to support@lebanonhockey.com.':
      'Vous préférez un autre mode de paiement? Faites un virement Interac au Canada à sales@lebanonhockey.com, ou utilisez PayPal à l’extérieur du Canada à support@lebanonhockey.com.',
    '11 products': '11 produits',
    'Suggested contributions of $20, $50, $100, or $200 — or choose your own amount, given once or as a recurring monthly gift.':
      'Dons suggérés de 20 $, 50 $, 100 $ ou 200 $ — ou choisissez le montant de votre choix, en un seul versement ou chaque mois.',
    'The federation is finishing its payment setup. If you would like to give now, email us and we will arrange it directly — your support matters either way.':
      'La fédération termine la configuration des paiements. Pour faire un don dès maintenant, écrivez-nous et nous organiserons le paiement directement. Votre soutien compte, quel que soit le mode de paiement.',
    'Email the federation': 'Écrire à la fédération',
    'See partnership options': 'Voir les options de partenariat',
    'I agree to display my name publicly on the donation leaderboard.':
      'J’accepte que mon nom soit affiché publiquement dans le classement des donateurs.',
    'Donations unavailable': 'Dons indisponibles',
    'Every gift counts': 'Chaque don compte',
    'Thank you for your support.': 'Merci de votre soutien.',
    'Interested in a bigger partnership instead? Explore our sponsorship tiers.':
      'Vous souhaitez plutôt établir un partenariat plus important? Découvrez nos niveaux de commandite.',
    'Become a sponsor': 'Devenir commanditaire',
    'Join the thrill': 'Vivez la passion',
    '1. Reach out with your name and role': '1. Communiquez-nous votre nom et votre rôle',
    "2. We'll send the registration details": '2. Nous vous enverrons les détails d’inscription',
    '3. Confirm your membership with the federation': '3. Confirmez votre adhésion auprès de la fédération',
    'Welcome to Lebanon Hockey': 'Bienvenue chez Lebanon Hockey',
    'Card payment is not switched on yet': 'Le paiement par carte n’est pas encore activé',
    'You can still register now — the federation will confirm by email and the fee is paid by Interac e-Transfer or PayPal to support@lebanonhockey.com.':
      'Vous pouvez tout de même vous inscrire maintenant. La fédération vous confirmera l’inscription par courriel; les frais se paient par virement Interac ou PayPal à support@lebanonhockey.com.',
    'You can still register now — the federation will confirm by email and the fee is paid by Interac e-Transfer or PayPal to':
      'Vous pouvez tout de même vous inscrire maintenant. La fédération vous confirmera l’inscription par courriel; les frais se paient par virement Interac ou PayPal à',
    'As written in your passport, so it matches your travel documents.':
      'Comme indiqué dans votre passeport, afin que les renseignements correspondent à vos documents de voyage.',
    'The IIHF decides who may represent Lebanon internationally, and that decision rests on citizenship — including a parent’s. That is the only reason these are asked. Supporters are never asked for them.':
      'L’IIHF détermine qui peut représenter le Liban à l’international, et cette décision repose sur la citoyenneté, y compris celle d’un parent. C’est la seule raison pour laquelle ces renseignements sont demandés. Ils ne sont jamais demandés aux partisans.',
    'Choose membership type': 'Choisissez un type d’adhésion',
    'Your details are used to process this registration and are not shared with anyone outside the federation. See our privacy policy.':
      'Vos renseignements servent au traitement de cette inscription et ne sont communiqués à personne à l’extérieur de la fédération. Consultez notre politique de confidentialité.',
    'Your details are used to process this registration and are not shared with anyone outside the federation. See our':
      'Vos renseignements servent au traitement de cette inscription et ne sont communiqués à personne à l’extérieur de la fédération. Consultez notre',
    'privacy policy': 'politique de confidentialité',
    'Chat with the federation': 'Clavarder avec la fédération',
    Chat: 'Clavarder',
    Menu: 'Menu',
    'View cart': 'Voir le panier',
    'Create an account': 'Créer un compte',
    'In stock': 'En stock',
    'Out of stock': 'En rupture de stock',
    'Choose a category': 'Choisir une catégorie',
    'Choose a size': 'Choisir une taille',
    'Choose a colour': 'Choisir une couleur',
    'Choose a color': 'Choisir une couleur',
    'Select a size': 'Sélectionner une taille',
    'Select a colour': 'Sélectionner une couleur',
    'Select a color': 'Sélectionner une couleur',
    'Choose a membership type': 'Choisissez un type d’adhésion',
    'Payments unavailable': 'Paiements indisponibles',
    'Place order': 'Passer la commande',
    'Placing your order...': 'Commande en cours…',
    'Redirecting to payment...': 'Redirection vers le paiement…',
    'Pay securely': 'Payer en toute sécurité',
    'Payment could not be started.': 'Le paiement n’a pas pu être lancé.',
    'Checkout cancelled. Your cart is still here.': 'Paiement annulé. Votre panier est toujours là.',
    'No order specified': 'Aucune commande précisée',
    'Could not load that order': 'Impossible de charger cette commande',
    'Could not load your cart': 'Impossible de charger votre panier',
    'Could not load the store': 'Impossible de charger la boutique',
    'Could not load your orders': 'Impossible de charger vos commandes',
    'Could not load': 'Impossible de charger',
    'Remove from cart': 'Retirer du panier',
    'Removed from cart.': 'Article retiré du panier.',
    'Choose an amount to give.': 'Choisissez un montant à donner.',
    'The donation could not be started.': 'Le don n’a pas pu être lancé.',
    'Continue to payment': 'Continuer vers le paiement',
    'No payment was taken. Your gift was not completed.': 'Aucun paiement n’a été effectué. Votre don n’a pas été complété.',
    'No payment was taken. Your registration was not completed.': 'Aucun paiement n’a été effectué. Votre inscription n’a pas été complétée.',
    'Sending...': 'Envoi en cours…',
    'Working...': 'Traitement en cours…',
    'Thanks for reaching out. We will be in touch.': 'Merci de nous avoir écrit. Nous communiquerons avec vous.',
    'Password changed. Other devices were signed out.': 'Mot de passe modifié. Les autres appareils ont été déconnectés.',
    'Profile saved.': 'Profil enregistré.',
    'Order summary': 'Récapitulatif de la commande',
    'Community Events': 'Événements communautaires',
    Leadership: 'Direction',
    Athlete: 'Athlète',
    Community: 'Communauté',
    'Thank you for your order.': 'Merci pour votre commande.',
    'Account': 'Compte',
    'Building a fast, proud hockey community through programs, camps, events, and partnerships across Canada and Lebanon.':
      'Bâtir une communauté de hockey dynamique et fière grâce à des programmes, des camps, des événements et des partenariats au Canada et au Liban.',
    'View this page in English': 'Voir cette page en anglais',
    'Membership registration': 'Inscription à l’adhésion',
    'Browse the official collection and support Lebanese ice hockey.':
      'Découvrez la collection officielle et soutenez le hockey sur glace libanais.',
    'Go to the store': 'Accéder à la boutique',
    'GO TO THE STORE': 'ACCÉDER À LA BOUTIQUE',
    'Youth Camp': 'Camp jeunesse',
    'YOUTH CAMP': 'CAMP JEUNESSE',
    Series: 'Série',
    Tournament: 'Tournoi',
    'Montreal Challengers Series': 'Série des Challengers de Montréal',
    'Hockey Quebec Youth Camp 2026': 'Camp de hockey jeunesse de Hockey Québec 2026',
    'The inaugural Cedars Cup comes to Edmonton in June 2027, bringing together more than six men\'s and women\'s national teams. Full details are in the schedule below.':
      'La première Coupe des Cèdres aura lieu à Edmonton en juin 2027 et réunira plus de six équipes nationales masculines et féminines. Consultez le calendrier ci-dessous pour tous les détails.',
    'A free hockey experience for kids ages 7 to 13, July 11, 2026.':
      'Une activité de hockey gratuite pour les jeunes de 7 à 13 ans, le 11 juillet 2026.',
    'A free hockey experience for ages 7 to 13, all skill levels. 1:30 to 4:30 PM: 90 minutes on-ice and 60 minutes off-ice, free beginner equipment rental, and a chance to meet National Team players. Food, drinks and admission are all free. Space is limited and camps fill up quickly - contact the federation to join the waitlist. Camp participants get free admission to Challenger Series games.':
      'Une activité de hockey gratuite pour les jeunes de 7 à 13 ans, quel que soit leur niveau. De 13 h 30 à 16 h 30 : 90 minutes sur la glace et 60 minutes hors glace, prêt gratuit d’équipement pour débutants et possibilité de rencontrer des joueurs de l’équipe nationale. La nourriture, les boissons et l’entrée sont gratuites. Les places sont limitées et les camps se remplissent rapidement : communiquez avec la fédération pour vous inscrire sur la liste d’attente. Les participants au camp bénéficient d’une entrée gratuite aux matchs de la Série des Challengers.',
    'JOIN THE WAITLIST': 'INSCRIVEZ-VOUS SUR LA LISTE D’ATTENTE',
    'The inaugural Cedars Cup, created by the federation to bring together more than six men’s and women’s national teams. A new international platform for competition, cultural exchange and the continued growth of Lebanese hockey worldwide. The long-term ambition is to host it in Lebanon once the necessary ice facilities exist.':
      'La première Coupe des Cèdres, créée par la fédération, réunira plus de six équipes nationales masculines et féminines. Cette nouvelle plateforme internationale favorisera la compétition, les échanges culturels et le développement du hockey libanais dans le monde. À long terme, l’objectif est de tenir le tournoi au Liban lorsque les installations de glace nécessaires seront disponibles.',
    'Men\'s, women\'s, and youth development': 'Développement des programmes masculins, féminins et jeunesse',
    'MESSAGE': 'MESSAGE',
    'General enquiries': 'Renseignements généraux',
    'Store and orders': 'Boutique et commandes',
    'Playing and tryouts': 'Jouer et participer aux essais',
    Sponsorship: 'Commandite',
    'We read everything that comes in and reply as quickly as we can. If your question is about an order, please include the order number — it saves a round trip.':
      'Nous lisons tous les messages reçus et répondons aussi rapidement que possible. Pour toute question concernant une commande, veuillez en indiquer le numéro afin d’éviter des échanges supplémentaires.',
    'We use one cookie, and no tracking of any kind.': 'Nous utilisons un seul témoin et aucun outil de suivi.',
    'There are no analytics cookies, no advertising cookies, no social media pixels, and no third-party scripts on this site.':
      'Ce site n’utilise aucun témoin d’analyse ou de publicité, aucun pixel de réseau social et aucun script tiers.',
    Name: 'Nom',
    Purpose: 'Utilisation',
    'Set when': 'Moment d’activation',
    Expires: 'Expiration',
    Type: 'Type',
    'Identifies your browsing session so we can remember what is in your cart, keep you signed in, and protect forms against cross-site request forgery.':
      'Identifie votre session de navigation afin de mémoriser le contenu de votre panier, de vous garder connecté et de protéger les formulaires contre la falsification de requêtes intersites.',
    'Only when you first add something to the cart, sign in, register, or submit a form. Simply reading pages sets no cookie at all.':
      'Uniquement lorsque vous ajoutez un article au panier, vous connectez, vous inscrivez ou envoyez un formulaire pour la première fois. La simple consultation des pages n’installe aucun témoin.',
    '30 days, or immediately when you sign out': '30 jours, ou immédiatement lorsque vous vous déconnectez',
    'First-party, strictly necessary,': 'Émis par le site, strictement nécessaire,',
    'Consent banners exist because of cookies that track you. Ours does not:':
      'Les bannières de consentement existent à cause des témoins qui suivent votre activité. Le nôtre ne le fait pas :',
    'is strictly necessary to deliver a service you have explicitly asked for — keeping your cart, or keeping you signed in — and cookies of that kind are recognised as exempt from prior consent under Quebec\'s Law 25 and comparable rules elsewhere.':
      'est strictement nécessaire pour fournir un service que vous avez demandé explicitement — conserver votre panier ou votre connexion — et les témoins de ce type sont reconnus comme exemptés du consentement préalable en vertu de la Loi 25 du Québec et de règles comparables ailleurs.',
    'Cookies set by Stripe during payment': 'Témoins installés par Stripe pendant le paiement',
    'When you check out, we send you to Stripe\'s own hosted payment page at':
      'Lorsque vous passez à la caisse, nous vous dirigeons vers la page de paiement hébergée par Stripe à l’adresse',
    '. Stripe sets its own cookies there for fraud prevention and to operate that page. Those cookies belong to Stripe, are set on Stripe\'s domain, and are governed by Stripe\'s privacy policy — we cannot read them. You are returned to our site once payment completes.':
      '. Stripe y installe ses propres témoins pour prévenir la fraude et faire fonctionner cette page. Ces témoins appartiennent à Stripe, sont installés sur son domaine et sont régis par sa politique de confidentialité; nous ne pouvons pas les lire. Vous revenez sur notre site une fois le paiement terminé.',
    'Similar technologies': 'Technologies similaires',
    'The shop uses your browser\'s': 'La boutique utilise la fonction',
    'to remember a discount code you have typed while you move between the cart and checkout. That information stays on your device, is cleared when you close the tab, and is never sent anywhere except when you apply the code.':
      'de votre navigateur pour mémoriser un code de réduction saisi lorsque vous passez du panier au paiement. Cette information reste sur votre appareil, est effacée lorsque vous fermez l’onglet et n’est envoyée que lorsque vous appliquez le code.',
    'If you start a chat with us, your browser\'s': 'Si vous commencez une conversation avec nous, la fonction',
    'keeps one value,': 'de votre navigateur conserve une valeur,',
    'so your conversation is still there as you move from page to page or come back later. It identifies the conversation and nothing else — it is not an account, it is not linked to your name unless you tell us, and it is not used to follow you around the site. Clearing your browser storage ends that conversation; you can always start a new one.':
      'afin que votre conversation soit conservée lorsque vous naviguez entre les pages ou revenez plus tard. Cette valeur identifie uniquement la conversation : il ne s’agit pas d’un compte, elle n’est pas associée à votre nom sauf si vous nous le communiquez et ne sert pas à suivre votre navigation. Effacer le stockage de votre navigateur met fin à cette conversation; vous pouvez toujours en commencer une nouvelle.',
    'Controlling cookies': 'Gestion des témoins',
    'You can delete or block cookies in your browser settings, usually under Privacy or Site Data.':
      'Vous pouvez supprimer ou bloquer les témoins dans les paramètres de votre navigateur, généralement sous « Confidentialité » ou « Données des sites ». ',
    'Blocking': 'Le blocage de',
    'will stop the shopping cart and sign-in from working, because the site has no other way to recognise your session. The rest of the site will still work normally.':
      'empêchera le panier et la connexion de fonctionner, car le site ne dispose d’aucun autre moyen de reconnaître votre session. Le reste du site continuera de fonctionner normalement.',
    'Questions about this policy? Email': 'Des questions sur cette politique? Écrivez à',
    '. See also our': '. Consultez également notre',
    'Why there is no cookie banner': 'Pourquoi il n’y a pas de bannière de témoins',
    'You can delete or block cookies in your browser settings, usually under Privacy or Site Data. Blocking':
      'Vous pouvez supprimer ou bloquer les témoins dans les paramètres de votre navigateur, généralement sous « Confidentialité » ou « Données des sites ». Le blocage de',
    ', so your conversation is still there as you move from page to page or come back later. It identifies the conversation and nothing else — it is not an account, it is not linked to your name unless you tell us, and it is not used to follow you around the site. Clearing your browser storage ends that conversation; you can always start a new one.':
      ', afin que votre conversation soit conservée lorsque vous naviguez entre les pages ou revenez plus tard. Cette valeur identifie uniquement la conversation : il ne s’agit pas d’un compte, elle n’est pas associée à votre nom sauf si vous nous le communiquez et ne sert pas à suivre votre navigation. Effacer le stockage de votre navigateur met fin à cette conversation; vous pouvez toujours en commencer une nouvelle.',
    'Your email': 'Votre courriel',
    '(optional, so we can reply if you leave)': '(facultatif, pour que nous puissions répondre si vous quittez)',
    'Your message': 'Votre message',
    'Write your message...': 'Écrivez votre message...',
    'Close chat': 'Fermer la conversation',
    'That is a lot of messages at once. Please wait a moment and try again.':
      'Vous avez envoyé beaucoup de messages à la fois. Veuillez patienter un instant et réessayer.',
    'That message did not send. Please try again, or email info@lebanonhockey.com.':
      'Votre message n’a pas été envoyé. Veuillez réessayer ou écrire à info@lebanonhockey.com.',
    'Chat launcher': 'Ouvrir le clavardage',
    'Read more': 'Lire la suite',
    'No posts yet': 'Aucune nouvelle pour le moment',
    'Copy link': 'Copier le lien',
    'Share on Facebook': 'Partager sur Facebook',
    'Share on X': 'Partager sur X',
    'Share on WhatsApp': 'Partager sur WhatsApp',
    'See the federation post': 'Voir la publication de la fédération',
    'See it on Instagram': 'Voir sur Instagram',
    'Share this post': 'Partager cette publication',
    'Share…': 'Partager…',
    'Link copied.': 'Lien copié.',
    'Could not copy the link.': 'Impossible de copier le lien.',
    'View the photo for': 'Voir la photo de',
    'full screen': 'en plein écran',
    'Teams are being published. Check back soon.': 'Les équipes seront publiées bientôt. Revenez nous voir.',
    'Roster coming soon': 'Alignement à venir',
    'Partner announcements are on their way.': 'Les annonces concernant nos partenaires arriveront bientôt.',
    'Date to be announced': 'Date à annoncer',
    'More details': 'Plus de détails',
    'No orders yet': 'Aucune commande pour le moment',
    'When you place an order it will appear here with its invoice.':
      'Vos commandes et leurs factures s’afficheront ici une fois votre commande passée.',
    'Visit the store': 'Visiter la boutique',
    'Orders': 'Commandes',
    'Change password': 'Modifier le mot de passe',
    'Invoice': 'Facture',
    'Details': 'Détails',
    'This link is missing its token.': 'Le jeton est manquant dans ce lien.',
    'Request a new one': 'Demander un nouveau lien',
    'If that email has an account, a reset link is on its way.':
      'Si un compte est associé à cette adresse courriel, un lien de réinitialisation vous sera envoyé.',
    'Select a country': 'Sélectionner un pays',
    'Choose your country': 'Choisissez votre pays',
    'Shipping address': 'Adresse de livraison',
    'Payment method': 'Mode de paiement',
    'Search products': 'Rechercher des produits',
    'Sort products': 'Trier les produits',
    'Nothing matches those filters': 'Aucun résultat ne correspond à ces filtres',
    'Try a different search term, or clear the filters to see the full collection.':
      'Essayez un autre terme de recherche ou effacez les filtres pour afficher toute la collection.',
    'Categories unavailable.': 'Catégories indisponibles.',
    'Prev': 'Précédent',
    'Next': 'Suivant',
    'No products': 'Aucun produit',
    'Decrease quantity': 'Diminuer la quantité',
    'Increase quantity': 'Augmenter la quantité',
    'Quantity': 'Quantité',
    'Sold out': 'Épuisé',
    'You may also like': 'Vous aimerez peut-être aussi',
    'Measurement': 'Mesure',
    'Download the full specification (PDF)': 'Télécharger la fiche complète (PDF)',
    'All sales are final, so sizing is worth a minute. These are made-to-order jerseys and fit looser than a regular shirt — most people take their usual size. Measurements are in inches.':
      'Toutes les ventes sont finales; prenez donc un moment pour vérifier la taille. Ces chandails fabriqués sur commande sont plus amples qu’un t-shirt ordinaire; la plupart des gens choisissent leur taille habituelle. Les mesures sont en pouces.',
    'No active news': 'Aucune actualité',
    'Thanks for your message. We will reply as soon as we can.':
      'Merci pour votre message. Nous vous répondrons dès que possible.',
    'Registration received': 'Inscription reçue',
    'Thank you. Your registration is recorded and a confirmation is on its way by email.':
      'Merci. Votre inscription a été enregistrée et une confirmation vous sera envoyée par courriel.',
    'To complete it, send': 'Pour la finaliser, envoyez',
    'by Interac e-Transfer': 'par virement Interac',
    'and include your name so the federation can match the payment to your registration.':
      'et indiquez votre nom afin que la fédération puisse associer le paiement à votre inscription.',
    'Confirming your payment': 'Confirmation de votre paiement',
    'This usually takes a couple of seconds.': 'Cela prend généralement quelques secondes.',
    'You are registered': 'Votre inscription est confirmée',
    'Your registration is recorded. We are still waiting on the payment provider to confirm the fee.':
      'Votre inscription a été enregistrée. Nous attendons encore la confirmation des frais par le fournisseur de paiement.',
    'We could not confirm that': 'Nous n’avons pas pu confirmer le paiement',
    'Filter by': 'Filtrer par',
    'All categories': 'Toutes les catégories',
    'Price range': 'Fourchette de prix',
    'Minimum price': 'Prix minimum',
    'Maximum price': 'Prix maximum',
    'Show filters': 'Afficher les filtres',
    'Hide filters': 'Masquer les filtres',
    'Apply': 'Appliquer',
    'Reset': 'Réinitialiser',
    'You have': 'Vous avez',
    'products in your cart': 'produits dans votre panier',
    'Cart item': 'Article du panier',
    'You are sent to Stripe to pay; card details never reach our servers. A confirmation is emailed to you — it is not an official tax receipt.':
      'Vous êtes redirigé vers Stripe pour effectuer le paiement; les données de votre carte ne transitent jamais par nos serveurs. Une confirmation vous sera envoyée par courriel; il ne s’agit pas d’un reçu officiel aux fins de l’impôt.',
    'Everyone listed here asked to be named. Gifts are shown once they have been received.':
      'Toutes les personnes inscrites ont demandé à être nommées. Les dons sont affichés après leur réception.',
    ' — thank you for your trust.': ' — merci de votre confiance.',
    'Choose your jersey type, colour and size on each product page. If you need anything clarified before ordering, email':
      'Choisissez le type, la couleur et la taille du chandail sur sa page produit. Pour toute question avant de commander, écrivez à',
    'Prefer to pay another way? Interac e-Transfer within Canada to':
      'Vous préférez un autre mode de paiement? Faites un virement Interac au Canada à',
    ', or PayPal from outside Canada to':
      ', ou utilisez PayPal à l’extérieur du Canada à',
    Subtotal: 'Sous-total',
    Shipping: 'Livraison',
    Tax: 'Taxes',
    Total: 'Total',
    Discount: 'Réduction',
    Free: 'Gratuit',
    'Discount code': 'Code de réduction',
    'Secure checkout. Card details are handled by Stripe and never touch our servers.':
      'Le paiement est sécurisé. Les données de carte sont traitées par Stripe et ne transitent jamais par nos serveurs.',
    'Estimate — enter your country at checkout for the exact rate':
      'Estimation — indiquez votre pays au paiement pour connaître le tarif exact.',
    'Spend': 'Dépensez',
    'more for free shipping.': 'de plus pour bénéficier de la livraison gratuite.',
    'Code': 'Code',
    applied: 'appliqué',
    'each': 'chacun',
    'Not enough stock - reduce the quantity to continue.':
      'Stock insuffisant : réduisez la quantité pour continuer.',
    'Monthly': 'Mensuel',
    'required for monthly gifts': 'obligatoire pour les dons mensuels',
    'optional': 'facultatif',
    'Your gift was not completed.': 'Votre don n’a pas été complété.',
    'Confirming your gift': 'Confirmation de votre don',
    'Gift received': 'Don reçu',
    'Your monthly gift of': 'Votre don mensuel de',
    'Your gift of': 'Votre don de',
    'is set up': 'est configuré',
    'has been received': 'a été reçu',
    'A confirmation is on its way to': 'Une confirmation sera envoyée à',
    'We have your gift and are waiting on the payment provider to confirm it. Status:':
      'Nous avons reçu votre don et attendons sa confirmation par le fournisseur de paiement. État :',
    'The confirmation email has a link you can use to change or stop your monthly gift at any time.':
      'Le courriel de confirmation contient un lien qui vous permet de modifier ou d’interrompre votre don mensuel à tout moment.',
    'This is a confirmation of your payment, not an official tax receipt.':
      'Ceci confirme votre paiement; il ne s’agit pas d’un reçu officiel aux fins de l’impôt.',
    'Order received': 'Commande reçue',
    'Thank you': 'Merci',
    'is confirmed. A receipt is on its way to': 'est confirmée. Un reçu sera envoyé à',
    'is recorded with status': 'a été enregistrée avec l’état',
    'Qty': 'Qté',
    'It is not paid yet. Send an Interac e-Transfer with the details below and we will confirm as soon as it arrives — usually within a working day. We have emailed you a copy.':
      'Le paiement n’a pas encore été effectué. Envoyez un virement Interac selon les détails ci-dessous; nous confirmerons sa réception, généralement dans un jour ouvrable. Nous vous en avons envoyé une copie par courriel.',
    'Send to': 'Destinataire',
    'Recipient name': 'Nom du destinataire',
    'Message field': 'Champ de message',
    'Please put': 'Veuillez inscrire',
    'in the transfer message. Without it we may not be able to match your payment to this order.':
      'dans le message du virement. Sans cette référence, nous ne pourrons peut-être pas associer votre paiement à cette commande.',
    'View your order': 'Voir votre commande',
    'Account sections': 'Sections du compte',
    'Search name or email': 'Rechercher par nom ou courriel',
    'These details are required.': 'Ces renseignements sont obligatoires.',
    'Enter a valid phone number.': 'Saisissez un numéro de téléphone valide.',
    'This field is not in the expected format.': 'Ce champ n’a pas le format attendu.',
    'This is not a valid amount.': 'Ce montant n’est pas valide.',
    'Wrong email or password.': 'Adresse courriel ou mot de passe incorrect.',
    'Email already in use.': 'Cette adresse courriel est déjà utilisée.',
    'Password must be at least 8 characters.': 'Le mot de passe doit contenir au moins 8 caractères.',
    'Current password is incorrect.': 'Le mot de passe actuel est incorrect.',
    'Invalid or expired reset link.': 'Le lien de réinitialisation est invalide ou expiré.',
    'Please enter a valid email address.': 'Veuillez saisir une adresse courriel valide.',
    'What we collect, why we collect it, and the control you have over it.':
      'Les renseignements que nous recueillons, leurs raisons et les choix qui s’offrent à vous.',
    'Act respecting the protection of personal information in the private sector':
      'Loi sur la protection des renseignements personnels dans le secteur privé',
    'Personal Information Protection and Electronic Documents Act':
      'Loi sur la protection des renseignements personnels et les documents électroniques',
    'Consumer Protection Act': 'Loi sur la protection du consommateur',
    'Commission d\'accès à l\'information': 'Commission d’accès à l’information',
    'Commission d\'accès à l\'information du Québec': 'Commission d’accès à l’information du Québec',
    'Office of the Privacy Commissioner of Canada': 'Commissariat à la protection de la vie privée du Canada',
    '1. Who is responsible': '1. Responsable du traitement',
    '2. What we collect': '2. Renseignements recueillis',
    'Information': 'Renseignement',
    'When': 'Quand',
    'Why': 'Pourquoi',
    'Email address, password (stored only as a cryptographic hash)':
      'Adresse courriel et mot de passe (conservé uniquement sous forme de hachage cryptographique)',
    'When you create an account': 'Lors de la création d’un compte',
    'To identify you and secure your account': 'Pour vous identifier et protéger votre compte',
    'Name, phone number': 'Nom et numéro de téléphone',
    'Account profile, checkout': 'Profil du compte, paiement',
    'To address you and contact you about an order':
      'Pour vous adresser et communiquer avec vous au sujet d’une commande',
    'At checkout': 'Au paiement',
    'To deliver your order and print your invoice':
      'Pour livrer votre commande et produire votre facture',
    'Order and invoice history': 'Historique des commandes et des factures',
    'When you buy something': 'Lors d’un achat',
    'To fulfil the order and meet tax record-keeping obligations':
      'Pour traiter la commande et respecter les obligations de conservation des documents fiscaux',
    'Messages you send us': 'Messages que vous nous envoyez',
    'Contact form': 'Formulaire de contact',
    'To answer your enquiry': 'Pour répondre à votre demande',
    'IP address and basic request logs': 'Adresse IP et journaux de requêtes de base',
    'Automatically': 'Automatiquement',
    'Security, abuse prevention, and rate limiting':
      'Sécurité, prévention des abus et limitation du débit',
    'A single session cookie (lh_sid)': 'Un seul témoin de session (lh_sid)',
    'Only once you use the cart, sign in, or submit a form':
      'Uniquement lorsque vous utilisez le panier, vous connectez ou envoyez un formulaire',
    'To keep you signed in and remember your cart. See the Cookie Policy.':
      'Pour maintenir votre connexion et mémoriser le contenu de votre panier. Consultez la politique relative aux témoins.',
    'To keep you signed in and remember your cart. See the':
      'Pour maintenir votre connexion et mémoriser le contenu de votre panier. Consultez la',
    'Membership registration: your name as written in your passport, date of birth, place and country of birth, city of residence, citizenship and second citizenship, your parents\' citizenships, and playing details (position, shoots, height, weight, highest level played)':
      'Inscription à l’adhésion : nom tel qu’il apparaît sur votre passeport, date et lieu de naissance, pays de naissance, ville de résidence, citoyenneté et deuxième citoyenneté, citoyennetés de vos parents et renseignements sportifs (position, côté de tir, taille, poids et niveau de jeu le plus élevé)',
    'When you submit the membership registration form, and only for player, coach and management memberships — supporter memberships are never asked for them':
      'Lors de l’envoi du formulaire d’adhésion, et uniquement pour les adhésions de joueur, d’entraîneur ou de gestionnaire — ces renseignements ne sont jamais demandés aux partisans',
    'To process your registration and to establish eligibility to represent Lebanon. The International Ice Hockey Federation decides eligibility on the basis of citizenship, including a parent\'s, which is the only reason we ask':
      'Pour traiter votre inscription et établir votre admissibilité à représenter le Liban. La Fédération internationale de hockey sur glace détermine l’admissibilité selon la citoyenneté, y compris celle d’un parent; c’est la seule raison pour laquelle nous demandons ces renseignements.',
    'Chat messages, and an email address if you choose to give one':
      'Messages de clavardage et adresse courriel, si vous choisissez de la fournir',
    'When you use the chat on the site': 'Lorsque vous utilisez le clavardage du site',
    'To answer your question, and to reply later if you leave before we can':
      'Pour répondre à votre question et pouvoir vous répondre plus tard si vous quittez avant notre réponse',
    'Donation details: name, email address, and any message you add':
      'Détails du don : nom, adresse courriel et tout message ajouté',
    'When you make a one-time or monthly donation': 'Lors d’un don ponctuel ou mensuel',
    'To confirm your gift and, for a monthly gift, to let you change or stop it':
      'Pour confirmer votre don et, dans le cas d’un don mensuel, vous permettre de le modifier ou de l’interrompre',
    'Your name on the public donation leaderboard': 'Votre nom dans le classement public des donateurs',
    'Only if you tick the box asking for it when you donate':
      'Uniquement si vous cochez la case correspondante au moment de votre don',
    'To thank supporters publicly. Nothing is published unless you ask for it, and never your email address, your message or anyone else’s details':
      'Pour remercier publiquement les personnes qui nous soutiennent. Rien n’est publié sans votre demande, et votre adresse courriel, votre message et les renseignements d’autrui ne le sont jamais.',
    'Your name goes on the donation leaderboard only if you ask.':
      'Votre nom n’apparaît dans le classement des donateurs que si vous le demandez.',
    'The box is unticked by default, and a gift is recorded whether or not you tick it. If you change your mind, email us and we will take your name off the page — your donation stays exactly as it is.':
      'La case n’est pas cochée par défaut et votre don est enregistré, que vous la cochiez ou non. Si vous changez d’avis, écrivez-nous et nous retirerons votre nom de la page; votre don ne sera pas modifié.',
    'We never see your card details.': 'Nous ne voyons jamais les données de votre carte.',
    '3. What we do not do': '3. Ce que nous ne faisons pas',
    'We do not sell, rent, or trade your personal information.':
      'Nous ne vendons, ne louons ni n’échangeons vos renseignements personnels.',
    'We do not use advertising or analytics trackers, and we do not profile you.':
      'Nous n’utilisons aucun outil de suivi publicitaire ou analytique et ne dressons aucun profil à votre sujet.',
    'We do not send marketing email. The only messages we send are transactional: order confirmations, invoices, password resets, and replies to your enquiries.':
      'Nous n’envoyons aucun courriel de marketing. Nos seuls messages sont transactionnels : confirmations de commande, factures, réinitialisations de mot de passe et réponses à vos demandes.',
    'We do not load fonts, scripts, or images from third-party servers, so browsing the site does not disclose your visit to anyone else.':
      'Nous ne chargeons aucune police, aucun script ni aucune image depuis des serveurs tiers; votre visite du site n’est donc pas divulguée à qui que ce soit.',
    '4. Who we share information with': '4. Avec qui nous partageons les renseignements',
    'Stripe Inc. (United States) — payment processing': 'Stripe Inc. (États-Unis) — traitement des paiements',
    'Receives your email address, order amount, and the card details you enter directly on their page. Stripe acts as an independent controller for payment data under its own privacy policy.':
      'Reçoit votre adresse courriel, le montant de la commande et les données de carte que vous saisissez directement sur sa page. Stripe agit comme responsable indépendant des données de paiement selon sa propre politique de confidentialité.',
    'Our email provider — transactional email': 'Notre fournisseur de courriel — envoi de messages transactionnels',
    'Receives your email address and the contents of the message being sent to you.':
      'Reçoit votre adresse courriel et le contenu du message qui vous est envoyé.',
    '5. Information stored outside Quebec': '5. Renseignements conservés à l’extérieur du Québec',
    '6. How long we keep it': '6. Durée de conservation',
    'Orders and invoices': 'Commandes et factures',
    'Account details': 'Détails du compte',
    'Sessions': 'Sessions',
    'Password reset links': 'Liens de réinitialisation du mot de passe',
    'Contact messages': 'Messages de contact',
    '7. How we protect it': '7. Comment nous protégeons vos renseignements',
    'The whole site is served over HTTPS in production.':
      'En production, tout le site est servi au moyen du protocole HTTPS.',
    'Passwords are stored using scrypt with a unique salt for each account. We cannot read your password, and neither can anyone who obtains the database.':
      'Les mots de passe sont stockés à l’aide de scrypt et d’un sel unique pour chaque compte. Nous ne pouvons pas lire votre mot de passe, pas plus qu’une personne qui obtiendrait la base de données.',
    'Session tokens are stored hashed, are rotated when you sign in, and can be revoked.':
      'Les jetons de session sont stockés sous forme hachée, renouvelés à la connexion et peuvent être révoqués.',
    'Administrative pages are restricted to accounts holding the admin role.':
      'L’accès aux pages d’administration est réservé aux comptes ayant le rôle administrateur.',
    'scrypt': 'scrypt',
    '8. Your rights': '8. Vos droits',
    'You may ask us at any time to:': 'Vous pouvez nous demander à tout moment de :',
    'Access': 'Accéder',
    'the personal information we hold about you.': 'aux renseignements personnels que nous détenons à votre sujet.',
    'Correct': 'Rectifier',
    'anything inaccurate or incomplete. You can edit your name, phone, and password yourself from':
      'tout renseignement inexact ou incomplet. Vous pouvez modifier vous-même votre nom, votre téléphone et votre mot de passe depuis',
    'your account': 'votre compte',
    'Delete': 'Supprimer',
    'your account and personal information, except records we must keep for tax purposes.':
      'votre compte et vos renseignements personnels, à l’exception des documents que nous devons conserver à des fins fiscales.',
    'Withdraw consent': 'Retirer votre consentement',
    'to a use you previously agreed to.': 'à une utilisation que vous aviez précédemment acceptée.',
    'Receive a copy': 'Recevoir une copie',
    'of the information you gave us in a structured, commonly used technical format (data portability under Law 25).':
      'des renseignements que vous nous avez fournis dans un format technique structuré et couramment utilisé (portabilité des données en vertu de la Loi 25).',
    '9. Automated decisions and profiling': '9. Décisions automatisées et profilage',
    '10. Children': '10. Enfants',
    'Membership registration for a player under 18 must be completed by a parent or guardian. The eligibility details it asks for — date of birth, place of birth and citizenships — are held for federation and IIHF purposes only, are visible to federation administrators, and are never published.':
      'L’inscription d’un joueur de moins de 18 ans doit être remplie par un parent ou un tuteur. Les renseignements d’admissibilité demandés — date et lieu de naissance, citoyennetés — sont conservés uniquement pour les besoins de la fédération et de l’IIHF, sont accessibles aux administrateurs de la fédération et ne sont jamais publiés.',
    'Team rosters published on this site name athletes, including athletes under 18, with the team they most recently played for and the town they are from. A parent or guardian may ask us at any time to remove a minor\'s name, or to show initials instead, and we will do so without question. Write to':
      'Les alignements publiés sur ce site indiquent le nom des athlètes, y compris ceux de moins de 18 ans, leur dernière équipe et leur ville. Un parent ou un tuteur peut nous demander à tout moment de retirer le nom d’un mineur ou d’afficher ses initiales; nous le ferons sans poser de question. Écrivez à',
    '11. If you are in the EEA or the UK': '11. Si vous résidez dans l’EEE ou au Royaume-Uni',
    'We are not established in Europe and do not target visitors there, but if you contact us from the EEA or the UK you may still ask us to access, correct, erase, or port your data, and to restrict or object to processing. Where we process your information it is because it is necessary to perform a contract with you (your order), to comply with a legal obligation (tax records), or for our legitimate interest in keeping the site secure.':
      'Nous ne sommes pas établis en Europe et ne ciblons pas les visiteurs qui s’y trouvent. Toutefois, si vous communiquez avec nous depuis l’EEE ou le Royaume-Uni, vous pouvez demander l’accès à vos données, leur rectification, leur effacement ou leur transfert, ainsi que la limitation ou l’opposition à leur traitement. Nous traitons vos renseignements lorsqu’ils sont nécessaires à l’exécution d’un contrat avec vous (votre commande), au respect d’une obligation légale (documents fiscaux) ou à notre intérêt légitime de sécuriser le site.',
    '12. Changes': '12. Modifications',
    'Questions?': 'Des questions?',
    '1. All sales are final': '1. Toutes les ventes sont finales',
    '2. Check your size before you order': '2. Vérifiez votre taille avant de commander',
    '3. Faulty, damaged, or incorrect items': '3. Articles défectueux, endommagés ou incorrects',
    '4. Personalized and custom-made items': '4. Articles personnalisés et fabriqués sur mesure',
    '5. Cancelling an order': '5. Annulation d’une commande',
    '6. Orders paid by Interac e-Transfer': '6. Commandes payées par virement Interac',
    '7. Delivery times': '7. Délais de livraison',
    '8. Donations and memberships': '8. Dons et adhésions',
    '9. Your statutory rights': '9. Vos droits prévus par la loi',
    'Stripe and our email provider process data in the United States and other countries, which means some of your information is stored or handled outside Quebec. Those jurisdictions may not offer protections equivalent to Quebec law. We rely on these providers\' contractual commitments and security certifications, and we assess this before entrusting them with personal information, as Law 25 requires. Order records, invoices, and account data that we hold ourselves remain on our own server.':
      'Stripe et notre fournisseur de courriel traitent des données aux États-Unis et dans d’autres pays; certains de vos renseignements sont donc stockés ou traités à l’extérieur du Québec. Ces territoires n’offrent pas nécessairement des protections équivalentes à celles du Québec. Nous nous appuyons sur les engagements contractuels et les certifications de sécurité de ces fournisseurs et évaluons ces éléments avant de leur confier des renseignements personnels, comme l’exige la Loi 25. Les commandes, factures et données de compte que nous conservons nous-mêmes demeurent sur notre propre serveur.',
    '— six years after the transaction, to meet Canada Revenue Agency record-keeping requirements.':
      '— six ans après la transaction, afin de respecter les exigences de conservation des documents de l’Agence du revenu du Canada.',
    '— until you ask us to delete the account.': '— jusqu’à ce que vous nous demandiez de supprimer le compte.',
    '— 30 days, or until you sign out.': '— 30 jours, ou jusqu’à votre déconnexion.',
    '— one hour, and they can be used only once.': '— une heure et ne peuvent être utilisés qu’une seule fois.',
    '— until your enquiry is resolved, then up to 12 months.':
      '— jusqu’à la résolution de votre demande, puis jusqu’à 12 mois.',
    'If a confidentiality incident occurs that presents a risk of serious injury, we will notify you and the':
      'Si un incident de confidentialité présente un risque de préjudice sérieux, nous vous en aviserons ainsi que la',
    'as Law 25 requires, and record it in our incident register.':
      'conformément à la Loi 25, et le consignerons dans notre registre des incidents.',
    'and we will respond within 30 days. If you are not satisfied with our answer, you may complain to the':
      'et nous vous répondrons dans les 30 jours. Si notre réponse ne vous satisfait pas, vous pouvez porter plainte auprès de la',
    'or to the': 'ou auprès du',
    'non-refundable and non-returnable': 'non remboursables et non retournables',
    'In short:': 'En bref :',
    '14 days of delivery': '14 jours suivant la livraison',
    'before': 'avant',
    'Something wrong with your order?': 'Un problème avec votre commande?',
    'The federation is a small organization and its merchandise is produced in short runs, much of it made to order. Stock that comes back cannot be resold, and the cost of handling returns comes straight out of what is available for the programs. This policy is what keeps the shop viable.':
      'La fédération est une petite organisation et ses articles sont produits en petites séries, souvent sur commande. Les articles retournés ne peuvent pas être revendus et les frais de traitement des retours réduisent directement les sommes disponibles pour les programmes. Cette politique permet à la boutique de poursuivre ses activités.',
    'Because an order cannot be exchanged, please check the sizing note on the product page before you buy, and ask us for the garment measurements if you are at all unsure. Email info@lebanonhockey.com before ordering and we will help you choose — we would far rather spend five minutes on that than have you stuck with something that does not fit.':
      'Comme une commande ne peut pas être échangée, vérifiez les indications de taille sur la page du produit avant de l’acheter et demandez-nous les mesures du vêtement si vous avez le moindre doute. Écrivez à info@lebanonhockey.com avant de commander et nous vous aiderons à choisir; nous préférons de loin y consacrer cinq minutes plutôt que de vous laisser avec un article qui ne vous convient pas.',
    'This is the exception, and it is not discretionary. If an item arrives faulty, damaged in transit, or is not the item you ordered, contact us within 14 days of delivery with your order number and photographs. We will replace it or refund it in full, including shipping, at no cost to you.':
      'Il s’agit de l’exception, et elle est obligatoire. Si un article est défectueux, endommagé pendant le transport ou différent de celui commandé, communiquez avec nous dans les 14 jours suivant la livraison en indiquant votre numéro de commande et en joignant des photos. Nous le remplacerons ou vous rembourserons intégralement, y compris les frais de livraison, sans frais pour vous.',
    'Items personalized with a name or number are made individually for you and cannot be resold in any circumstances. Please check the spelling and number on your order carefully before paying. Section 3 still applies: a personalized item that is faulty, or that was made with details different from the ones you submitted, is our error and we fix it.':
      'Les articles personnalisés avec un nom ou un numéro sont fabriqués spécialement pour vous et ne peuvent en aucun cas être revendus. Vérifiez attentivement l’orthographe et le numéro de votre commande avant de payer. La section 3 s’applique toujours : si un article personnalisé est défectueux ou comporte des renseignements différents de ceux que vous avez fournis, l’erreur nous revient et nous la corrigerons.',
    'An e-Transfer order is reserved when you place it and becomes final when the transfer arrives. If you decide not to send the transfer, simply do not send it — nothing is charged and the order lapses. Once the transfer has been received the policy above applies in full.':
      'Une commande payée par virement Interac est réservée au moment où vous la passez et devient définitive lorsque le virement est reçu. Si vous décidez de ne pas l’envoyer, ne faites tout simplement pas le virement : aucun montant ne sera prélevé et la commande expirera. Une fois le virement reçu, la politique ci-dessus s’applique intégralement.',
    'Most orders ship within 2–3 weeks. Delivery after that depends on where the parcel is going; the estimate for your destination is shown at checkout once you choose your country. A delivery taking longer than estimated is not grounds for a refund, but tell us if a parcel seems lost and we will chase it.':
      'La plupart des commandes sont expédiées dans un délai de 2 à 3 semaines. Le délai de livraison dépend ensuite de la destination; l’estimation s’affiche au paiement après la sélection du pays. Un délai supérieur à l’estimation ne donne pas droit à un remboursement, mais signalez-nous tout colis qui semble perdu et nous ferons le nécessaire.',
    'This policy does not and cannot limit your rights under Quebec\'s Consumer Protection Act or other applicable consumer law. Those rights apply in addition to the terms above, in particular where goods do not match their description or are not fit for their ordinary purpose. Where this policy and the law disagree, the law wins.':
      'Cette politique ne limite pas et ne peut pas limiter les droits que vous confère la Loi sur la protection du consommateur du Québec ou toute autre loi applicable en matière de consommation. Ces droits s’ajoutent aux conditions ci-dessus, notamment lorsque les biens ne correspondent pas à leur description ou ne conviennent pas à leur usage normal. En cas de divergence entre cette politique et la loi, la loi prévaut.',
  };

  const composedHeadings = {
    'Lebanese Ice Hockey Federation': {
      before: 'Fédération libanaise de hockey sur ',
      accent: 'glace',
    },
    'About Us': { before: 'À propos de ', accent: 'nous' },
    'Our Teams': { before: 'Nos ', accent: 'équipes' },
    'Become A Partner': { before: 'Devenez ', accent: 'partenaire' },
    'Fuel The Mission': { before: 'Faites avancer la ', accent: 'mission' },
    'Wear The Cedars': { before: 'Portez les ', accent: 'cèdres' },
    'Join The Thrill': { before: 'Vivez la ', accent: 'passion' },
    'Contact Us': { before: 'Nous ', accent: 'joindre' },
    Newsroom: { before: 'Actual', accent: 'ités' },
    'Federation Events': { before: 'Événements de la ', accent: 'fédération' },
    'Privacy Policy': { before: 'Politique de ', accent: 'confidentialité' },
    'Cookie Policy': { before: 'Politique relative aux ', accent: 'témoins' },
    'Refunds & Returns': { before: 'Remboursements et ', accent: 'retours' },
  };

  function localizeUrl(value) {
    if (!isFrench) return value;
    if (!value || /^(?:#|mailto:|tel:|javascript:|data:)/i.test(value)) return value;

    let url;
    try {
      const currentPath = window.location.pathname;
      const dynamicPage = /^\/fr\/(?:news|teams|players)\/[^/]+\/?$/.test(currentPath);
      url = new URL(value, `${window.location.origin}${dynamicPage ? '/fr/index.html' : currentPath}`);
    } catch {
      return value;
    }

    if (url.origin !== window.location.origin) return value;

    if (/^\/fr\/(?:assets|api)\//.test(url.pathname)) {
      url.pathname = url.pathname.replace(/^\/fr/, '');
      return `${url.pathname}${url.search}${url.hash}`;
    }

    if (/^\/(?:assets|api|admin)(?:\/|$)/.test(url.pathname)) return value;
    if (!/^\/fr(?:\/|$)/.test(url.pathname)) {
      url.pathname = `/fr${url.pathname === '/' ? '/' : url.pathname}`;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  }

  function translateValue(value) {
    const trimmed = value.trim();
    if (!trimmed) return value;
    const normalized = trimmed.replace(/\s+/g, ' ');
    const leading = value.match(/^\s*/)[0];
    const trailing = value.match(/\s*$/)[0];
    const translated = translations[normalized];
    if (translated === undefined) {
      const copyright = normalized.match(/^© (\d{4}) Lebanese Ice Hockey Federation\. All rights reserved\.$/);
      if (copyright) {
        return `${leading}© ${copyright[1]} Fédération libanaise de hockey sur glace. Tous droits réservés.${trailing}`;
      }
      const count = normalized.match(/^(\d+) products?$/i);
      if (count) {
        const product = count[1] === '1' ? 'produit' : 'produits';
        const replacement = `${count[1]} ${product}`;
        return `${leading}${replacement}${trailing}`;
      }
      const itemCount = normalized.match(/^(\d+) items?(.*)$/i);
      if (itemCount) {
        const item = itemCount[1] === '1' ? 'article' : 'articles';
        return `${leading}${itemCount[1]} ${item}${itemCount[2]}${trailing}`;
      }
      const freeShipping = normalized.match(/^Spend (.+) more for free shipping\.$/i);
      if (freeShipping) {
        return `${leading}Dépensez ${freeShipping[1]} de plus pour bénéficier de la livraison gratuite.${trailing}`;
      }
      const discountApplied = normalized.match(/^Code (.+) applied\.$/i);
      if (discountApplied) return `${leading}Le code ${discountApplied[1]} a été appliqué.${trailing}`;
      const discountLine = normalized.match(/^Discount \((.+)\)$/i);
      if (discountLine) return `${leading}Réduction (${discountLine[1]})${trailing}`;
      const orderReserved = normalized.match(/^Order (.+) is reserved$/i);
      if (orderReserved) return `${leading}La commande ${orderReserved[1]} est réservée${trailing}`;
      const orderEmail = normalized.match(/^ is confirmed\. A receipt is on its way to (.+)\.$/i);
      if (orderEmail) {
        return `${leading} est confirmée. Un reçu sera envoyé à ${orderEmail[1]}.${trailing}`;
      }
      const orderStatus = normalized.match(/^ is recorded with status (.+)\.$/i);
      if (orderStatus) return `${leading} a été enregistrée avec l’état ${orderStatus[1]}.${trailing}`;
      const emailConfirmation = normalized.match(/^ A confirmation is on its way to (.+)\.$/i);
      if (emailConfirmation) {
        return `${leading} Une confirmation sera envoyée à ${emailConfirmation[1]}.${trailing}`;
      }
      const photoLabel = normalized.match(/^View the photo for (.+) full screen$/i);
      if (photoLabel) {
        return `${leading}Voir la photo de ${photoLabel[1]} en plein écran${trailing}`;
      }
      const quantityLabel = normalized.match(/^Quantity for (.+)$/i);
      if (quantityLabel) return `${leading}Quantité pour ${quantityLabel[1]}${trailing}`;
      const required = normalized.match(/^(.+) is required\.$/i);
      if (required) return `${leading}${required[1]} est obligatoire.${trailing}`;
      const checkbox = normalized.match(/^Please tick (.+)\.$/i);
      if (checkbox) return `${leading}Veuillez cocher ${checkbox[1]}.${trailing}`;
      const choose = normalized.match(/^Choose (.+)\.$/i);
      if (choose) return `${leading}Choisissez ${choose[1]}.${trailing}`;
      const tooShort = normalized.match(/^(.+) must be at least (.+) characters\.$/i);
      if (tooShort) return `${leading}${tooShort[1]} doit contenir au moins ${tooShort[2]} caractères.${trailing}`;
      const tooLong = normalized.match(/^(.+) must be (.+) characters or fewer\.$/i);
      if (tooLong) return `${leading}${tooLong[1]} doit contenir au plus ${tooLong[2]} caractères.${trailing}`;
      const minimum = normalized.match(/^(.+) must be at least (.+)\.$/i);
      if (minimum) return `${leading}${minimum[1]} doit être d’au moins ${minimum[2]}.${trailing}`;
      const maximum = normalized.match(/^(.+) must be (.+) or less\.$/i);
      if (maximum) return `${leading}${maximum[1]} doit être inférieur ou égal à ${maximum[2]}.${trailing}`;
      const formatMismatch = normalized.match(/^(.+) is not in the expected format\.$/i);
      if (formatMismatch) return `${leading}${formatMismatch[1]} n’a pas le format attendu.${trailing}`;
      const stepMismatch = normalized.match(/^(.+) is not a valid amount\.$/i);
      if (stepMismatch) return `${leading}${stepMismatch[1]} n’est pas un montant valide.${trailing}`;
      const checkedFields = normalized.match(/^Please check (\d+) fields above before continuing\.$/i);
      if (checkedFields) {
        return `${leading}Veuillez vérifier les ${checkedFields[1]} champs ci-dessus avant de continuer.${trailing}`;
      }
      return value;
    }
    return `${leading}${translated}${trailing}`;
  }

  function translateComposedHeadings(root) {
    const selector = 'h1, h2, h3, h4, h5, h6';
    const headings =
      root instanceof Element && root.matches(selector)
        ? [root, ...root.querySelectorAll(selector)]
        : root.querySelectorAll(selector);

    for (const heading of headings) {
      const source = heading.textContent.replace(/\s+/g, ' ').trim();
      const translation = composedHeadings[source];
      if (!translation) continue;

      const accent = heading.querySelector('.accent');
      if (!accent) {
        heading.textContent = `${translation.before}${translation.accent}`;
        continue;
      }

      const firstText = Array.from(heading.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
      if (firstText) firstText.nodeValue = translation.before;
      else heading.insertBefore(document.createTextNode(translation.before), accent);
      accent.textContent = translation.accent;
      for (const node of Array.from(heading.childNodes)) {
        if (node !== firstText && node.nodeType === Node.TEXT_NODE) node.nodeValue = '';
      }
    }
  }

  function translateRichText(root) {
    const selector = 'p, td, th, li, dt, dd';
    const blocks =
      root instanceof Element && root.matches(selector)
        ? [root, ...root.querySelectorAll(selector)]
        : root.querySelectorAll(selector);
    const inlineTags = new Set(['A', 'ABBR', 'CODE', 'EM', 'S', 'SPAN', 'STRONG', 'SUB', 'SUP']);

    for (const block of blocks) {
      if (!block.children.length) continue;

      const source = block.textContent.replace(/\s+/g, ' ').trim();
      const translated = translations[source];
      if (translated === undefined) continue;

      const children = Array.from(block.childNodes);
      if (children.some((node) => node.nodeType === Node.ELEMENT_NODE && !inlineTags.has(node.tagName))) {
        continue;
      }

      const parts = [];
      let offset = 0;
      let canTranslate = true;
      for (const child of children) {
        if (child.nodeType !== Node.ELEMENT_NODE || !child.textContent.trim()) continue;

        const childText = child.textContent.replace(/\s+/g, ' ').trim();
        const localizedChild = translateValue(childText).trim();
        const childOffset = translated.indexOf(localizedChild, offset);
        if (!localizedChild || childOffset < 0) {
          canTranslate = false;
          break;
        }

        parts.push(document.createTextNode(translated.slice(offset, childOffset)), child);
        offset = childOffset + localizedChild.length;
      }
      if (!canTranslate) continue;

      parts.push(document.createTextNode(translated.slice(offset)));
      block.replaceChildren(...parts);
    }
  }

  function translateTree(root) {
    translateComposedHeadings(root);
    translateRichText(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest('script, style, noscript, [data-language-switch]')) continue;
      node.nodeValue = translateValue(node.nodeValue || '');
    }

    const elements = root instanceof Element ? [root, ...root.querySelectorAll('*')] : root.querySelectorAll('*');
    for (const element of elements) {
      for (const attribute of ['placeholder', 'aria-label', 'title', 'alt', 'value']) {
        const value = element.getAttribute(attribute);
        if (value) {
          const translated = translateValue(value);
          if (translated !== value) element.setAttribute(attribute, translated);
        }
      }

      for (const attribute of ['href', 'src']) {
        const value = element.getAttribute(attribute);
        if (value) {
          const localized = localizeUrl(value);
          if (localized !== value) element.setAttribute(attribute, localized);
        }
      }
    }
  }

  function addLanguageSwitch() {
    const header = document.querySelector('.site-header');
    const tools = header?.querySelector('.header-tools');
    if (!tools || header.querySelector('[data-language-switch]')) return;

    const link = document.createElement('a');
    link.className = 'language-switch';
    link.dataset.languageSwitch = '';
    const englishPath = window.location.pathname.replace(/^\/fr(?=\/|$)/, '') || '/';
    link.href = `${isFrench ? englishPath : `/fr${window.location.pathname}`}${window.location.search}${window.location.hash}`;
    link.textContent = isFrench ? 'English' : 'Français';
    link.setAttribute('aria-label', isFrench ? 'Voir cette page en anglais' : 'Voir cette page en français');
    tools.prepend(link);
  }

  if (isFrench) {
    document.documentElement.lang = 'fr';
    document.title = translateValue(document.title);
    document.querySelector('meta[name="description"]')?.setAttribute(
      'content',
      translateValue(document.querySelector('meta[name="description"]').content)
    );
    translateTree(document.body);
  }
  addLanguageSwitch();

  if (window.LH && isFrench) {
    window.LH.localizeUrl = localizeUrl;
  }

  if (isFrench) {
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes' && record.attributeName === 'href') {
          const element = record.target;
          const value = element.getAttribute('href');
          const localized = localizeUrl(value);
          if (localized !== value) element.setAttribute('href', localized);
        } else {
          record.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) translateTree(node);
            else if (node.nodeType === Node.TEXT_NODE) node.nodeValue = translateValue(node.nodeValue || '');
          });
        }
      }
    }).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href'],
    });
  }
})();
