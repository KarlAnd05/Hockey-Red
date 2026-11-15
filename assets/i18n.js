(function () {
  'use strict';

  const isFrench = /^\/fr(?:\/|$)/.test(window.location.pathname);

  const translations = {
    'Skip to content': 'Passer au contenu',
    Home: 'Accueil',
    About: 'À propos',
    Us: 'de nous',
    Our: 'Nos',
    Teams: 'équipes',
    'Become A': 'Devenez',
    Partner: 'partenaire',
    'Fuel The': 'Faites avancer la',
    Mission: 'mission',
    'Wear The': 'Portez les',
    Cedars: 'cèdres',
    room: '',
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
      return value;
    }
    return `${leading}${translated}${trailing}`;
  }

  function translateTree(root) {
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
