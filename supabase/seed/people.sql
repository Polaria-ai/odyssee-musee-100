-- Généré par scripts/import-people.ts — à relire, puis exécuter dans le SQL editor Supabase.
-- published = false (brouillon) : relire les fiches, puis relancer avec --publish avant la mise en ligne.
-- (sans --publish, le statut de publication des fiches déjà en base n'est jamais modifié.)
begin;

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'xianxin-guo', 1, 'Xianxin Guo', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'Lumai', 'GB', 'infrastructures',
  'Physicien, principal inventeur de la technologie de calcul optique de Lumai, spin-out d''Oxford, qu''il dirige : calculer avec la lumière pour réduire l''énergie que consomme l''IA.', 'A physicist and primary inventor of the optical computing technology at Oxford spin-out Lumai, which he now leads: computing with light to cut the energy AI consumes.', 'Docteur en physique de l''université de science et technologie de Hong Kong, Xianxin Guo passe par l''université de Calgary, puis par Oxford, où il obtient une bourse de recherche 1851. Il est l''inventeur principal de la technologie de Lumai, issue d''Oxford en 2021.

Lumai calcule avec des faisceaux de lumière plutôt qu''avec des électrons, pour les opérations au coeur des modèles d''IA. D''abord directeur de la recherche, Guo en est aujourd''hui le directeur général.

En avril 2025, Lumai annonce plus de 10 millions de dollars de financement. En avril 2026, elle présente sa famille de serveurs Iris.', 'Xianxin Guo holds a PhD in physics from the Hong Kong University of Science and Technology. He went on to the University of Calgary, then to Oxford, where he received a 1851 research fellowship. He is the main inventor of Lumai''s technology, which spun out of Oxford in 2021.

Lumai computes with beams of light rather than electrons, for the operations at the heart of AI models. First head of research, Guo is now chief executive.

In April 2025, Lumai announced over $10 million in funding. In April 2026, it unveiled its Iris family of servers.',
  'En faisant passer le calcul des électrons aux photons, Lumai peut offrir un gain de performance d''un ordre de grandeur, avec des économies d''énergie importantes.', '',
  '/portraits/xianxin-guo.webp', 'Photo : Lumai', '[{"label":"Lumai","url":"https://lumai.ai/about/"},{"label":"Lancement des serveurs Iris (avril 2026)","url":"https://lumai.ai/resources/lumai-launches-the-worlds-first-optical-computing-system-for-real-time-billion-parameter-llm-inference"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'jonathan-godwin', 2, 'Jonathan Godwin', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'Orbital Industries', 'GB', 'infrastructures',
  'Ancien de DeepMind, il dirige Orbital Industries, qui développe un fluide de refroidissement pour puces d''IA et des centres de données modulaires.', 'A DeepMind alumnus, he runs Orbital Industries, which develops a cooling fluid for AI chips and modular data centres.', 'Jonathan Godwin travaille chez Google DeepMind, le laboratoire d''IA de Google, sur l''IA appliquée aux sciences et aux matériaux. En 2022, il fonde Orbital, alors nommée Orbital Materials, avec James Gin-Pollock et Daniel Miodovnik.

L''entreprise, rebaptisée Orbital Industries, développe un fluide de refroidissement sans PFAS (composés chimiques persistants) pour les puces graphiques, et des centres de données modulaires, déployables en six mois seulement.

Le 28 mai 2026, elle lève 50 millions de dollars en série B, menée par Plural. Elle compte une cinquantaine de personnes.', 'Jonathan Godwin worked at Google DeepMind, Google''s AI lab, on AI for science and materials. In 2022, he founded Orbital, then called Orbital Materials, with James Gin-Pollock and Daniel Miodovnik.

The company, now Orbital Industries, develops a PFAS-free cooling fluid (PFAS are persistent chemicals) for graphics chips, and modular data centres that can be deployed in as little as six months.

On 28 May 2026, it raised $50 million in a Series B led by Plural. It has around fifty employees.',
  NULL, NULL,
  '/portraits/jonathan-godwin.webp', 'Photo : MCJ (podcast Inevitable)', '[{"label":"Orbital Industries","url":"https://www.orbitalindustries.com/"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'mattias-astrom', 3, 'Mattias Åström', 'Fondateur et directeur général', 'Founder and CEO',
  'evroc', 'SE', 'infrastructures',
  'Fondateur d''evroc, il bâtit un cloud et des centres de données pour l''IA qui restent sous contrôle européen, face aux géants américains.', 'Founder of evroc, he is building a cloud and AI data centres that stay under European control, in a market dominated by American giants.', 'Mattias Åström fonde evroc en 2022 avec une idée simple : donner à l''Europe un cloud, c''est-à-dire des serveurs loués à distance, qui ne dépende pas des fournisseurs américains. Le service est lancé le 1er juillet 2025.

En février 2025, evroc annonce une usine d''IA de 96 mégawatts à Mougins, pour environ 50 000 puces graphiques. En mars, l''entreprise lève plus de 50 millions d''euros en série A, avec Blisce, EQT Ventures, Norrsken VC et Giant Ventures.

En juin 2026, Mattias Åström est accueilli au conseil de l''ECFR, un think tank européen de politique étrangère, pour deux ans.', 'Mattias Åström founded evroc in 2022 with a simple idea: give Europe a cloud, meaning remotely rented servers, that does not depend on American providers. The service launched on 1 July 2025.

In February 2025, evroc announced a 96-megawatt AI factory in Mougins, for about 50,000 graphics chips. In March, the company raised more than 50 million euros in a Series A, with Blisce, EQT Ventures, Norrsken VC and Giant Ventures.

In June 2026, Mattias Åström was welcomed onto the council of the ECFR, a European foreign policy think tank, for two years.',
  'La capacité de l''Europe à agir de façon indépendante dans le monde est désormais indissociable de l''infrastructure numérique qu''elle maîtrise.', 'Europe''s ability to act independently in the world is now inseparable from the digital infrastructure it commands.',
  '/portraits/mattias-astrom.webp', 'Photo : evroc', '[{"label":"evroc","url":"https://evroc.com"},{"label":"Communiqué : nomination à l''ECFR","url":"https://news.cision.com/evroc/r/evroc-founder-joins-the-european-council-on-foreign-relations,c4388237"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'arthur-mensch', 4, 'Arthur Mensch', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'Mistral AI', 'FR', 'infrastructures',
  'Cofondateur de Mistral AI, start-up parisienne de modèles d''IA valorisée à plus de 21 milliards d''euros en septembre 2026.', 'Co-founder of Mistral AI, the Paris-based AI model start-up valued at more than 21 billion euros in September 2026.', 'Polytechnicien, passé par Télécom Paris et l''ENS Paris-Saclay, Arthur Mensch fait un doctorat sur l''analyse d''images du cerveau par IRM (2015-2018). Il rejoint DeepMind Paris en 2020, où il travaille sur les grands modèles de langage.

En avril 2023, il cofonde Mistral AI avec Guillaume Lample et Timothée Lacroix.

En septembre 2026, Mistral lève 3 milliards d''euros, menés par Samsung, pour une valorisation supérieure à 21 milliards. Les fonds doivent financer davantage de calcul et de nouveaux centres de données, en France et en Suède.', 'A graduate of École Polytechnique, Télécom Paris and ENS Paris-Saclay, Arthur Mensch earned a PhD on brain MRI image analysis (2015-2018). He joined DeepMind Paris in 2020, working on large language models.

In April 2023, he co-founded Mistral AI with Guillaume Lample and Timothée Lacroix.

In September 2026, Mistral raised 3 billion euros, led by Samsung, at a valuation above 21 billion. The funds are to finance more computing capacity and new data centers, in France and Sweden.',
  NULL, NULL,
  '/portraits/arthur-mensch.webp', 'Photo : Jan2342342423, CC0, via Wikimedia Commons', '[{"label":"Mistral AI","url":"https://mistral.ai"},{"label":"Wikipédia","url":"https://fr.wikipedia.org/wiki/Arthur_Mensch"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'christophe-fouquet', 5, 'Christophe Fouquet', 'Président et directeur général', 'President and Chief Executive Officer',
  'ASML', 'NL', 'infrastructures',
  'Il dirige ASML, seule entreprise à fabriquer les machines de lithographie EUV qui gravent les puces d''IA les plus avancées.', 'He runs ASML, the only company making the EUV lithography machines that etch the most advanced AI chips.', 'Ingénieur français né en 1973, titulaire d''un master de physique de l''Institut polytechnique de Grenoble, Christophe Fouquet travaille chez Applied Materials et KLA Tencor avant de rejoindre ASML en 2008. Il y dirige les applications, puis l''activité EUV (la lumière ultraviolette qui grave les puces les plus fines).

Il devient directeur général le 25 avril 2024. En septembre 2025, ASML mène un tour de table de 1,3 milliard d''euros dans Mistral AI (environ 11 % du capital, en base diluée).

En juillet 2026, ASML relève sa prévision de ventes 2026 à 43-45 milliards d''euros, portée par la demande liée à l''IA.', 'French engineer born in 1973, with a master''s degree in physics from Grenoble Institute of Technology, Christophe Fouquet works at Applied Materials and KLA Tencor before joining ASML in 2008. There he leads applications, then the EUV business (the ultraviolet light that etches the finest chips).

He becomes CEO on 25 April 2024. In September 2025, ASML leads a EUR 1.3 billion funding round in Mistral AI (about 11% of the capital, on a fully diluted basis).

In July 2026, ASML raises its 2026 sales forecast to EUR 43-45 billion, driven by AI-related demand.',
  NULL, NULL,
  '/portraits/christophe-fouquet.webp', 'Photo : ASML', '[{"label":"ASML : Board of Management","url":"https://www.asml.com/company/governance/board-of-management"},{"label":"ASML : présentation du nouveau CEO","url":"https://www.asml.com/en/news/stories/2024/christophe-fouquet-asml-ceo"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'josh-payne', 6, 'Josh Payne', 'Fondateur et directeur général', 'Founder and CEO',
  'Nscale', 'GB', 'infrastructures',
  'Entrepreneur australien, il a fondé Nscale en 2024 pour bâtir des centres de données et un cloud de GPU (puces de calcul) dédiés à l''IA. Il en est le directeur général.', 'An Australian entrepreneur, he founded Nscale in 2024 to build data centres and a GPU cloud (computing chips) dedicated to AI. He is its chief executive.', 'Josh Payne a fondé des entreprises dans le recrutement, les marchés de capitaux et les infrastructures de supercalcul. Nscale naît en 2024 à Londres, issue d''Arkon Energy, société d''infrastructures basée à Melbourne.

Après 155 millions de dollars en série A (décembre 2024), Nscale lève 2 milliards de dollars en série C en mars 2026, pour une valorisation de 14,6 milliards.

En mars 2026, elle rachète American Intelligence & Power Corporation : un campus en Virginie-Occidentale et un micro-réseau électrique extensible à plus de 8 gigawatts.', 'Josh Payne founded companies in recruitment, capital markets and supercomputing infrastructure. Nscale was born in London in 2024, out of Arkon Energy, an infrastructure company based in Melbourne.

After a $155 million Series A (December 2024), Nscale raised $2 billion in a Series C in March 2026, at a $14.6 billion valuation.

In March 2026, it acquired American Intelligence & Power Corporation: a West Virginia campus and an electric microgrid scalable to over 8 gigawatts.',
  NULL, NULL,
  '/portraits/josh-payne.webp', 'Photo : Nscale', '[{"label":"Nscale – équipe dirigeante","url":"https://www.nscale.com/about"},{"label":"Nscale sur Wikipédia","url":"https://en.wikipedia.org/wiki/Nscale"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'demis-hassabis', 7, 'Demis Hassabis', 'Président de DeepMind et directeur scientifique d''Alphabet', 'Chair of DeepMind and Alphabet chief scientist',
  'Google DeepMind', 'GB', 'infrastructures',
  'Cofondateur de DeepMind, prix Nobel de chimie 2024 pour la prédiction de structures de protéines, il dirige aussi Isomorphic Labs.', 'Co-founder of DeepMind, 2024 Nobel laureate in Chemistry for protein structure prediction, he also leads Isomorphic Labs.', 'Diplômé en informatique de Cambridge (1997), Demis Hassabis fonde un studio de jeux vidéo, puis passe un doctorat de neurosciences à UCL (2009). Il cofonde DeepMind en 2010 ; Google la rachète en 2014.

AlphaFold 2 (2020) prédit la forme des protéines. Ce travail lui vaut le prix Nobel de chimie 2024, prix partagé.

En août 2026, il quitte la direction de DeepMind pour la présider et devenir directeur scientifique d''Alphabet. Il reste PDG d''Isomorphic Labs.', 'A Cambridge computer science graduate (1997), Demis Hassabis founds a video game studio, then earns a neuroscience PhD at UCL (2009). He co-founds DeepMind in 2010; Google acquires it in 2014.

AlphaFold 2 (2020) predicts the shape of proteins. The work earns him the 2024 Nobel Prize in Chemistry, a shared prize.

In August 2026, he steps down as DeepMind''s CEO to chair it and become Alphabet''s chief scientist. He remains CEO of Isomorphic Labs.',
  NULL, NULL,
  '/portraits/demis-hassabis.webp', 'Photo : John Sears, CC BY-SA 4.0, via Wikimedia Commons', '[{"label":"Google DeepMind","url":"https://deepmind.google/about/"},{"label":"Wikipédia (EN)","url":"https://en.wikipedia.org/wiki/Demis_Hassabis"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'philippe-notton', 8, 'Philippe Notton', 'Fondateur et directeur général', 'Founder and CEO',
  'SiPearl', 'FR', 'infrastructures',
  'Il a fondé SiPearl pour rendre à l''Europe la conception de processeurs haute performance, dont celui qui équipera JUPITER, premier supercalculateur exascale européen.', 'He founded SiPearl to bring high-performance processor design back to Europe, including the chip that will equip JUPITER, Europe''s first exascale supercomputer.', 'Philippe Notton est ingénieur diplômé de Supélec et titulaire d''un Executive MBA de l''ESSEC et de Mannheim. Il passe par Thomson, Canal+, LSI Logic, STMicroelectronics et Atos. En 2017, chez Atos, il monte le consortium European Processor Initiative, pour relancer en Europe la conception de processeurs haute performance. Il crée SiPearl en juin 2019.

Le 13 mai 2026, SiPearl a allumé le premier Rhea1, une puce à 80 cœurs Arm gravée par TSMC. Livraison aux clients prévue fin 2026. Elle équipera JUPITER, premier supercalculateur exascale d''Europe.', 'Philippe Notton is a Supélec-trained engineer with an Executive MBA from ESSEC and Mannheim. He worked at Thomson, Canal+, LSI Logic, STMicroelectronics and Atos. In 2017, at Atos, he set up the European Processor Initiative consortium to bring high-performance processor design back to Europe. He created SiPearl in June 2019.

On 13 May 2026, SiPearl powered on the first Rhea1, an 80-core Arm chip made by TSMC. Delivery to customers is planned for late 2026. It will equip JUPITER, Europe''s first exascale supercomputer.',
  NULL, NULL,
  '/portraits/philippe-notton.webp', 'Photo : SiPearl', '[{"label":"Page de Philippe Notton sur SiPearl","url":"https://sipearl.com/philippe-notton"},{"label":"Profil EIC (Ambassadeur)","url":"https://eic.ec.europa.eu/philippe-notton_en"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'james-dacombe', 9, 'James Dacombe', 'Fondateur et directeur général', 'Founder and CEO',
  'Olix', 'GB', 'infrastructures',
  'Fondateur d''Olix, start-up londonienne qui conçoit des puces d''inférence reliées par la lumière pour réduire le coût de fonctionnement des modèles d''IA.', 'Founder of Olix, a London start-up designing inference chips linked by light to cut the cost of running AI models.', 'Originaire de Harrogate (Royaume-Uni), James Dacombe quitte le lycée après deux jours. À 17 ans, il fonde CoMind, une entreprise de neurotechnologie. Il reçoit une bourse Thiel en 2022.

En 2024, il crée Olix, d''abord nommée Flux Computing. La société conçoit des puces pour l''inférence (faire tourner un modèle d''IA déjà entraîné), reliées par des liens optiques plutôt que par du cuivre.

Le 3 août 2026, Olix annonce une levée de 312 millions de dollars, pour une valorisation de 3,3 milliards. Les premiers systèmes DX-1 sont attendus chez les clients au second semestre 2027.', 'Originally from Harrogate, UK, James Dacombe left sixth-form college after two days. At 17, he founded CoMind, a neurotechnology company. He received a Thiel Fellowship in 2022.

In 2024, he created Olix, first named Flux Computing. The company designs chips for inference (running an already-trained AI model), linked by optical connections rather than copper.

On 3 August 2026, Olix announced a $312 million round at a $3.3 billion valuation. The first DX-1 systems are due to reach customers in the second half of 2027.',
  NULL, NULL,
  NULL, NULL, '[{"label":"Olix","url":"https://olix.com"},{"label":"Annonce de la Series B d''Olix","url":"https://olix.com/news/company-raises-series-b"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'david-silver', 10, 'David Silver', 'Fondateur et directeur général', 'Founder and CEO',
  'Ineffable Intelligence', 'GB', 'infrastructures',
  'Il a dirigé AlphaGo chez DeepMind. En 2026, il quitte DeepMind pour fonder à Londres Ineffable Intelligence, qui vise une IA apprenant par l''expérience.', 'He led AlphaGo at DeepMind. In 2026 he left DeepMind to found Ineffable Intelligence in London, which aims at AI that learns from experience.', 'Diplômé de Cambridge en 1997, David Silver cofonde un studio de jeux vidéo, puis passe un doctorat sur l''apprentissage par renforcement à l''université d''Alberta (2009). Il rejoint DeepMind à plein temps en 2013 et y dirige AlphaGo, AlphaZero et MuZero.\n\nIl quitte DeepMind en janvier 2026 pour fonder Ineffable Intelligence, à Londres. Il défend une IA qui apprend par l''expérience, sans dépendre des données humaines.\n\nEn avril 2026, la start-up annonce 1,1 milliard de dollars levés pour 5,1 milliards de valorisation, le plus grand tour d''amorçage d''Europe.', 'A Cambridge graduate (1997), David Silver co-founded a video game studio, then completed a PhD on reinforcement learning at the University of Alberta (2009). He joined DeepMind full time in 2013, where he led AlphaGo, AlphaZero and MuZero.\n\nHe left DeepMind in January 2026 to found Ineffable Intelligence in London. He argues for AI that learns from experience rather than relying on human data.\n\nIn April 2026, the start-up announced $1.1 billion raised at a $5.1 billion valuation, the largest seed round in Europe.',
  NULL, NULL,
  '/portraits/david-silver.webp', 'Photo : The Royal Society', '[{"label":"Ineffable Intelligence","url":"https://ineffable.ai"},{"label":"Royal Society","url":"https://royalsociety.org/people/david-silver-35033"},{"label":"Wikipedia","url":"https://en.wikipedia.org/wiki/David_Silver_(computer_scientist)"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'jean-marc-chery', 11, 'Jean-Marc Chéry', 'Président et directeur général', 'President and Chief Executive Officer',
  'STMicroelectronics', 'FR', 'infrastructures',
  'Il dirige depuis 2018 STMicroelectronics, fabricant franco-italien de puces pour l''automobile, l''industrie et les centres de données d''IA.', 'He has led STMicroelectronics since 2018, a Franco-Italian maker of chips for cars, industry and AI data centres.', 'Né à Orléans en 1960, Jean-Marc Chéry sort des Arts et Métiers (ENSAM) en 1983. Il débute chez Matra, puis rejoint en 1986 Thomson Semiconducteurs, devenu STMicroelectronics, où il dirige des usines.

Directeur technique en 2008, directeur des opérations en 2014, directeur général délégué en 2017, il devient président et directeur général en mai 2018. Il préside la Global Semiconductor Alliance depuis décembre 2024.

En mars 2026, ST lance la production en grande série de PIC100, une plateforme de photonique sur silicium (des puces qui transmettent les données par la lumière) pour les centres de données.', 'Born in Orléans in 1960, Jean-Marc Chéry graduated from Arts et Métiers (ENSAM) in 1983. He started at Matra, then joined Thomson Semiconducteurs in 1986, later renamed STMicroelectronics, where he ran factories.

Chief Technology Officer in 2008, Chief Operating Officer in 2014 and Deputy CEO in 2017, he became President and CEO in May 2018. He has chaired the Global Semiconductor Alliance since December 2024.

In March 2026, ST entered high-volume production of PIC100, a silicon photonics platform (chips that move data with light) for data centres.',
  NULL, NULL,
  '/portraits/jean-marc-chery.webp', 'Photo : Capgemini', '[{"label":"Page de profil, Capgemini","url":"https://www.capgemini.com/fr-fr/notre-groupe/gestion-gouvernance/equipe-de-direction/jean-marc-chery/"},{"label":"Article Wikipédia","url":"https://fr.wikipedia.org/wiki/Jean-Marc_Ch%C3%A9ry"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'octave-klaba', 12, 'Octave Klaba', 'Fondateur, président-directeur général', 'Founder, Chairman and CEO',
  'OVHcloud', 'FR', 'infrastructures',
  'Fondateur d''OVHcloud, fournisseur de cloud européen, il en a repris la direction en 2025 et mise sur ses propres modèles d''IA.', 'Founder of OVHcloud, a European cloud provider, he took back its leadership in 2025 and is betting on the company''s own AI models.', 'Né en Pologne, Octave Klaba étudie l''ingénierie à l''ICAM de Lille et fonde OVH à Roubaix en novembre 1999. L''entreprise loue des serveurs et de l''hébergement web. Devenue OVHcloud, elle exploite 46 centres de données sur quatre continents.

Il quitte la direction opérationnelle en 2018 et reste président du conseil. Le 20 octobre 2025, il redevient président-directeur général.

En juin 2026, OVHcloud prévoit d''investir 150 à 200 millions d''euros dans ses propres modèles de langage. Un premier a été pré-entraîné sur Jupiter, supercalculateur européen.', 'Born in Poland, Octave Klaba studied engineering at ICAM in Lille and founded OVH in Roubaix in November 1999. The company rents servers and web hosting. Now OVHcloud, it runs 46 data centres across four continents.

He stepped back from day-to-day management in 2018 and stayed chairman. On 20 October 2025, he became chairman and CEO again.

In June 2026, OVHcloud plans to invest 150 to 200 million euros in its own language models. A first one has been pre-trained on Jupiter, a European supercomputer.',
  NULL, NULL,
  '/portraits/octave-klaba.webp', 'Photo : Stefanie Loos / Union européenne, CC BY 4.0, via Wikimedia Commons', '[{"label":"OVHcloud - à propos","url":"https://www.ovhcloud.com/en/about-us/"},{"label":"Octave Klaba sur Wikipédia","url":"https://fr.wikipedia.org/wiki/Octave_Klaba"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'arnaud-lepinois', 15, 'Arnaud Lépinois', 'Directeur général', 'CEO',
  'Eclairion', 'FR', 'infrastructures',
  'Il a dirigé HP France et Computacenter France, puis dirige Eclairion, qui héberge en France des supercalculateurs d''IA dans des centres de données modulaires.', 'He ran HP France and Computacenter France, and now leads Eclairion, which hosts AI supercomputers in France in modular data centres.', 'Diplômé de l''INSA Lyon en 1998, Arnaud Lépinois débute chez IBM, passe par le conseil informatique et fonde Neoxo. Il dirige Computacenter France dès janvier 2018, puis préside HP France dès novembre 2020.

Eclairion, créée en 2022, héberge des supercalculateurs dans des conteneurs modulaires refroidis par liquide : jusqu''à 600 kW par baie, contre 6 à 10 kW dans un centre classique.

En juillet 2026, Eclairion renforce son partenariat avec Schneider Electric, partenaire technologique pour ses modules électriques préfabriqués. Plus d''un gigawatt de capacité supplémentaire est en préparation.', 'A graduate of INSA Lyon in 1998, Arnaud Lépinois started at IBM, worked in IT consulting and founded Neoxo. He ran Computacenter France from January 2018, then chaired HP France from November 2020.

Eclairion, created in 2022, hosts supercomputers in liquid-cooled modular containers: up to 600 kW per rack, versus 6 to 10 kW in a conventional data centre.

In July 2026, Eclairion strengthened its partnership with Schneider Electric, its technology partner for prefabricated electrical modules. Over one gigawatt of additional capacity is in preparation.',
  NULL, NULL,
  NULL, NULL, '[{"label":"Eclairion","url":"https://eclairion.com/en/"},{"label":"Communiqué Schneider Electric x Eclairion","url":"https://www.se.com/fr/fr/about-us/newsroom/news/press-releases/eclairion-et-schneider-electric-renforcent-leur-partenariat-pour-acc%C3%A9l%C3%A9rer-le-d%C3%A9ploiement-d%E2%80%99infrastructures-d%E2%80%99intelligence-artificielle-souveraines-en-france-6a6c75b5cc6ba9fd1103cd79/"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'robin-rombach', 17, 'Robin Rombach', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'Black Forest Labs', 'DE', 'infrastructures',
  'Il a contribué à Stable Diffusion, puis dirige à Fribourg le laboratoire qui développe les modèles d''image FLUX.', 'He helped build Stable Diffusion, then leads the Freiburg lab behind the FLUX image models.', 'Robin Rombach étudie la physique à Heidelberg, puis prépare un doctorat à l''université de Munich (LMU), où il travaille sur les modèles génératifs d''images. Il devient ensuite directeur de recherche chez Stability AI.

En 2024, il fonde Black Forest Labs à Fribourg, notamment avec Andreas Blattmann et Patrick Esser, anciens de Stability AI. L''entreprise développe les modèles d''image FLUX.

Le 1er décembre 2025, elle lève 300 millions de dollars, pour une valorisation de 3,25 milliards. En septembre 2026, l''équipe compte un peu plus de 100 personnes ; son dernier modèle, pour la robotique, est testé chez Audi.', 'Robin Rombach studied physics at Heidelberg, then pursued a PhD at LMU Munich, working on generative image models. He then became a research director at Stability AI.

In 2024, he founded Black Forest Labs in Freiburg, notably with Andreas Blattmann and Patrick Esser, also Stability AI alumni. The company builds the FLUX image models.

On December 1, 2025, it raised $300 million at a $3.25 billion valuation. As of September 2026, the team has just over 100 people; its latest model, for robotics, is being tested at Audi.',
  'Je pense que l''état d''esprit en Europe doit évoluer vers l''optimisme et l''opportunité, et non vers le risque et la peur.', 'I think the mindset in Europe needs to shift to one of optimism and to one of opportunity, and not to one of risk and fear',
  '/portraits/robin-rombach.webp', 'Photo : Bits & Pretzels', '[{"label":"Black Forest Labs","url":"https://bfl.ai/about"},{"label":"Black Forest Labs (Wikipédia)","url":"https://en.wikipedia.org/wiki/Flux_(text-to-image_model)"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'roman-orus', 18, 'Román Orús', 'Cofondateur et directeur scientifique', 'Co-founder and Chief Scientific Officer',
  'Multiverse Computing', 'ES', 'infrastructures',
  'Physicien quantique, il cofonde Multiverse Computing et y dirige la science : des méthodes issues de la physique pour compresser les grands modèles d''IA.', 'A quantum physicist, he co-founded Multiverse Computing and leads its science: physics-based methods to compress large AI models.', 'Román Orús obtient son doctorat de physique à l''université de Barcelone en 2006. Après l''université du Queensland et l''Institut Max-Planck d''optique quantique, il devient en 2017 professeur de recherche Ikerbasque au Donostia International Physics Center.

En 2019, il cofonde Multiverse Computing. Il s''appuie sur les réseaux de tenseurs, un outil de la physique quantique qui représente de grands ensembles de données de façon compacte, pour réduire, selon l''entreprise, de 80 à 95 % la taille de modèles d''IA.

Le 27 juillet 2026, l''entreprise annonce une série C visant jusqu''à 500 M€.', 'Román Orús earned his physics PhD at the University of Barcelona in 2006. After posts at the University of Queensland and the Max Planck Institute of Quantum Optics, he became an Ikerbasque Research Professor at the Donostia International Physics Center in 2017.

In 2019, he co-founded Multiverse Computing. He draws on tensor networks, a quantum physics tool that represents large datasets compactly, to shrink AI models by 80 to 95%, according to the company.

On 27 July 2026, the company announced a Series C round targeting up to 500 million euros.',
  NULL, NULL,
  '/portraits/roman-orus.webp', 'Photo : Estudio Badator, CC0, via Wikimedia Commons', '[{"label":"Multiverse Computing","url":"https://multiversecomputing.com/ethics-committee"},{"label":"Wikipedia","url":"https://en.wikipedia.org/wiki/Rom%C3%A1n_Or%C3%BAs"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'damien-lucas', 21, 'Damien Lucas', 'Directeur général', 'CEO',
  'Scaleway', 'FR', 'infrastructures',
  'Directeur général de Scaleway, le cloud du groupe Iliad, il propose de la puissance de calcul pour l''IA, dont des puces graphiques (GPU).', 'CEO of Scaleway, the cloud arm of the Iliad group, he offers computing power for AI, including graphics processors (GPUs).', 'Diplômé de CentraleSupélec, Damien Lucas fait partie de l''équipe fondatrice du lecteur multimédia VLC. En 2003, il cofonde Anevia, éditeur de logiciels de diffusion vidéo, qu''Ateme rachète en 2020 ; il y devient directeur produit.

Il dirige Scaleway, filiale cloud du groupe Iliad, depuis 2023. Le cloud loue des serveurs à distance ; Scaleway y ajoute des puces graphiques (GPU) pour entraîner des modèles d''IA.

En mai 2026, Scaleway annonce avec d''autres acteurs le consortium AION, candidat à une « gigafactory » d''IA en France, avec un gigawatt de puissance de calcul visé.', 'A CentraleSupélec graduate, Damien Lucas is part of the founding team of the VLC media player. In 2003 he co-founds Anevia, a video streaming software company that Ateme acquires in 2020; he becomes its product director there.

He has led Scaleway, the cloud subsidiary of the Iliad group, since 2023. The cloud rents servers remotely; Scaleway adds graphics processors (GPUs) to train AI models.

In May 2026, Scaleway announces, with other partners, the AION consortium, bidding for an AI "gigafactory" in France, with one gigawatt of computing power targeted.',
  'L''Europe ne peut plus se permettre de sous-traiter les fondations de son avenir en IA, et nous saluons l''initiative des autorités européennes,', 'Europe can no longer afford to outsource the foundations of its AI future, and we welcome the initiative of the European authorities,',
  '/portraits/damien-lucas.webp', 'Photo : Scaleway', '[{"label":"Scaleway","url":"https://www.scaleway.com/en/about-us/"},{"label":"Scaleway et le consortium AION","url":"https://www.scaleway.com/en/news/scaleway-launches-the-aion-consortium-a-bold-project-to-build-europes-next-ai-gigafactory/"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'evangelos-eleftheriou', 22, 'Evangelos Eleftheriou', 'Cofondateur et directeur technique', 'Co-founder and Chief Technology Officer',
  'Axelera AI', 'CH', 'infrastructures',
  'Après plus de 35 ans de recherche chez IBM à Zurich, où il est nommé IBM Fellow en 2005, il dirige la technologie d''Axelera AI, qui conçoit des puces d''accélération de l''IA.', 'After more than 35 years of research at IBM in Zurich, where he was named IBM Fellow in 2005, he leads technology at Axelera AI, which designs AI acceleration chips.', 'Diplômé de l''université de Patras (Grèce) en 1979, il obtient un master puis un doctorat en génie électrique à Carleton University (Ottawa). Il rejoint IBM Research – Zurich en 1986 et devient IBM Fellow en 2005.

En 2016, son équipe présente dans Nature Nanotechnology des neurones artificiels en matériau à changement de phase, qui imitent le déclenchement d''un neurone. Il cofonde ensuite Axelera AI.

En février 2026, Axelera annonce plus de 200 millions d''euros de financement, avec la participation du EIC Fund.', 'A graduate of the University of Patras (Greece) in 1979, he earned a master''s and a PhD in electrical engineering at Carleton University (Ottawa). He joined IBM Research – Zurich in 1986 and became an IBM Fellow in 2005.

In 2016, his team presented in Nature Nanotechnology artificial neurons made of phase-change material, which mimic how a neuron fires. He then co-founded Axelera AI.

In February 2026, Axelera announced over 200 million euros in funding, with participation from the EIC Fund.',
  NULL, NULL,
  '/portraits/evangelos-eleftheriou.webp', 'Photo : Axelera AI', '[{"label":"Page équipe Axelera AI","url":"https://axelera.ai/our-team/evangelos-eleftheriou"},{"label":"Wikipédia (EN)","url":"https://en.wikipedia.org/wiki/Evangelos_Eleftheriou"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'walter-goodwin', 25, 'Walter Goodwin', 'Fondateur et directeur général', 'Founder and CEO',
  'Fractile', 'GB', 'infrastructures',
  'Roboticien formé à Oxford, il fonde Fractile en 2022 pour concevoir des puces qui accélèrent l''inférence, le moment où un modèle d''IA répond.', 'An Oxford-trained roboticist, he founded Fractile in 2022 to build chips that speed up inference, the moment an AI model produces its answer.', 'Walter Goodwin mène un doctorat à l''Université d''Oxford, sur l''usage des grands modèles de fondation pour une robotique généraliste. Il fonde Fractile en 2022, à l''issue de ses recherches doctorales.

Fractile conçoit des puces d''inférence, celles qui font répondre un modèle déjà entraîné. Leur mémoire et leur calcul sont entrelacés ; la société annonce des modèles jusqu''à 25 fois plus rapides, pour un dixième du coût.

En mai 2026, elle lève 220 millions de dollars. En août, la presse rapporte un accord initial d''environ 250 millions de dollars de puces avec Anthropic, à livrer en 2027.', 'Walter Goodwin carried out doctoral research at the University of Oxford, on using large foundation models for general-purpose robotics. He founded Fractile in 2022, following that research.

Fractile designs inference chips, the ones that make an already-trained model answer. Its memory and compute are interleaved; the company claims models up to 25 times faster at a tenth of the cost.

In May 2026, it raised 220 million dollars. In August, the press reported an initial deal of about 250 million dollars of chips with Anthropic, to be delivered in 2027.',
  NULL, NULL,
  '/portraits/walter-goodwin.webp', 'Photo : Fractile', '[{"label":"Fractile","url":"https://www.fractile.ai"},{"label":"Équipe Fractile","url":"https://www.fractile.ai/about"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'khaled-maalej', 28, 'Khaled Maalej', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'VSORA', 'FR', 'infrastructures',
  'Cofondateur de VSORA, il conçoit en France des puces pour l''inférence, l''étape où une IA répond aux requêtes, et vise une alternative européenne.', 'Co-founder of VSORA, he designs chips in France for inference, the stage where an AI answers requests, and aims to offer a European alternative.', 'Khaled Maalej passe son bac en Tunisie en 1987, puis étudie à l''École polytechnique et à Télécom Paris. Il travaille chez Sagem, puis cofonde DiBcom en 2000 : des puces qui permettent de recevoir la télévision numérique sur des appareils mobiles. L''entreprise est rachetée par Parrot.

En 2015, il crée VSORA avec d''anciens collègues. Elle conçoit des puces d''inférence, l''étape où un modèle d''IA déjà entraîné répond aux requêtes. En avril 2025, elle lève 46 millions de dollars ; en juillet 2026, Ardian Semiconductor y prend une participation minoritaire.', 'Khaled Maalej took his baccalaureate in Tunisia in 1987, then studied at École Polytechnique and Télécom Paris. He worked at Sagem, then co-founded DiBcom in 2000: chips that let mobile devices receive digital television. The company was acquired by Parrot.

In 2015, he created VSORA with former colleagues. It designs inference chips, the stage where an already trained AI model answers requests. In April 2025, it raised 46 million dollars; in July 2026, Ardian Semiconductor took a minority stake.',
  'Cette levée de fonds marque un tournant pour VSORA : nous accélérons notre mission de révolutionner les puces d''IA et de garantir la souveraineté technologique de l''Europe en calcul IA.', 'This funding marks a pivotal moment for VSORA as we accelerate our mission to revolutionize AI chips and ensure Europe''s technological sovereignty in AI computing.',
  '/portraits/khaled-maalej.webp', 'Photo : Systematic Paris-Region', '[{"label":"VSORA","url":"https://vsora.com"},{"label":"Interview Systematic Paris-Region","url":"https://systematic-paris-region.org/rencontre-avec-khaled-maalej-ceo-de-vsora-champion-2025-du-pole-systematic/"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'peter-sarlin', 30, 'Peter Sarlin', 'Président du conseil d''administration', 'Chairman of the Board',
  'NestAI', 'FI', 'infrastructures',
  'Fondateur de Silo AI, rachetée par AMD en 2024, il préside aujourd''hui NestAI, laboratoire finlandais d''IA physique, et Qutwo, jeune pousse du quantique.', 'Founder of Silo AI, acquired by AMD in 2024, he now chairs NestAI, a Finnish physical AI lab, and Qutwo, a quantum computing startup.', 'Docteur en apprentissage automatique, Peter Sarlin a occupé des postes académiques à Imperial College London, à la London School of Economics et à l''University of Technology Sydney, et travaillé à la Banque centrale européenne et au FMI. Il cofonde Silo AI, laboratoire d''IA privé racheté par AMD en 2024.

Il préside aujourd''hui NestAI, qui veut bâtir un laboratoire européen d''IA physique (l''IA qui pilote des machines), et Qutwo, dédiée au quantique. Il est aussi professeur de pratique à Aalto University.

En novembre 2025, NestAI lève 100 millions d''euros avec Nokia et Tesi. En mai 2026, Zalando l''élit à son conseil de surveillance.', 'A PhD in machine learning, Peter Sarlin has held academic posts at Imperial College London, the London School of Economics and the University of Technology Sydney, and worked at the European Central Bank and the IMF. He co-founded Silo AI, a private AI lab acquired by AMD in 2024.

He now chairs NestAI, which aims to build a European physical AI lab (AI that drives machines), and Qutwo, focused on quantum computing. He is also Professor of Practice at Aalto University.

In November 2025, NestAI raised 100 million euros with Nokia and Tesi. In May 2026, Zalando elected him to its supervisory board.',
  NULL, NULL,
  '/portraits/peter-sarlin.webp', 'Photo : Slush', '[{"label":"Profil Slush 2026","url":"https://slush.org/2026-speakers/peter-sarlin"},{"label":"Annonce du partenariat Nokia et de la levée de NestAI","url":"https://www.globenewswire.com/news-release/2025/11/20/3191671/0/en/Nokia-and-NestAI-announce-strategic-partnership-and-NestAI-raises-100m-to-accelerate-physical-AI-innovation.html"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'amin-shokrollahi', 32, 'Amin Shokrollahi', 'Cofondateur et directeur technique', 'Co-founder and CTO',
  'Kandou AI', 'CH', 'infrastructures',
  'Mathématicien du codage, il a inventé les codes Raptor puis cofondé Kandou AI, qui travaille sur les échanges de données entre puces pour l''IA.', 'A coding-theory mathematician, he invented Raptor codes, then co-founded Kandou AI, which works on data exchange between chips for AI.', 'Amin Shokrollahi obtient son doctorat en 1991 à l''université de Karlsruhe. Il travaille sur les codes correcteurs d''erreurs, qui protègent les données pendant leur transmission. Chez Digital Fountain, il invente les codes Raptor. L''IEEE lui remet la médaille Hamming en 2012.

En 2011, il fonde Kandou Bus à l''EPFL, à Lausanne, pour accélérer les échanges entre puces. Il est aujourd''hui professeur émérite de l''école.

En avril 2025, il devient directeur technique de Kandou AI. En mars 2026, l''entreprise lève 225 millions de dollars, menée par Maverick Silicon.', 'Amin Shokrollahi earned his doctorate in 1991 at the University of Karlsruhe. He works on error-correcting codes, which protect data while it travels. At Digital Fountain, he invented Raptor codes. The IEEE awarded him the Hamming Medal in 2012.

In 2011, he founded Kandou Bus at EPFL in Lausanne, to speed up exchanges between chips. He is now professor emeritus at the school.

In April 2025, he became chief technology officer of Kandou AI. In March 2026, the company raised 225 million dollars, led by Maverick Silicon.',
  'En devenant directeur technique, je me réjouis de consacrer mon énergie à la prochaine génération d''innovations technologiques pour le matériel d''IA.', 'As I step into the role of CTO, I am excited to dedicate my focus to driving the next generation of technological innovations in the AI hardware space.',
  '/portraits/amin-shokrollahi.webp', 'Photo : Renate Schmid, CC BY-SA 2.0 de, via Wikimedia Commons', '[{"label":"Kandou AI, équipe dirigeante","url":"https://kandou.com/about/"},{"label":"Article Wikipédia","url":"https://en.wikipedia.org/wiki/Amin_Shokrollahi"},{"label":"EPFL : levée de fonds de Kandou AI","url":"https://actu.epfl.ch/news/ic-spinoff-kandou-ai-raises-225m-for-faster-ai-i-2/"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'vaysh-kewada', 36, 'Vaysh Kewada', 'Cofondatrice et directrice générale', 'Co-founder and CEO',
  'Salience Labs', 'GB', 'infrastructures',
  'Cofondatrice de Salience Labs (Oxford), elle conçoit des commutateurs optiques qui relient les machines des centres de données d''IA avec de la lumière plutôt que de l''électricité.', 'Co-founder of Salience Labs (Oxford), she designs optical switches that connect the machines in AI data centres using light rather than electricity.', 'Vaysh Kewada étudie la physique à l''Imperial College London. Elle est analyste chez McKinsey, puis entrepreneure en résidence chez Oxford Sciences Innovation.

Elle cofonde Salience Labs, issue d''Oxford et de l''université de Münster. Sa technologie de puce photonique (qui calcule avec la lumière) a fait l''objet d''une publication dans Nature en 2020. Basée à Oxford, l''entreprise conçoit des commutateurs optiques, qui aiguillent la lumière entre les machines d''un centre de données d''IA.

En février 2025, elle lève 30 millions de dollars en série A. En mars 2026, Salience Labs lance un commutateur optique à 32 ports.', 'Vaysh Kewada studied physics at Imperial College London. She worked as an analyst at McKinsey, then as an entrepreneur in residence at Oxford Sciences Innovation.

She co-founded Salience Labs, a spin-out of Oxford and the University of Münster. Its photonic chip technology (computing with light) was the subject of a 2020 paper in Nature. Based in Oxford, the company designs optical switches, which steer light between the machines of an AI data centre.

In February 2025, she raised 30 million dollars in a Series A. In March 2026, Salience Labs launched a 32-port optical switch.',
  'La commutation optique fait passer les réseaux du routage électronique de paquets à une connectivité optique très prévisible et économe en énergie.', 'Optical switching is moving networks from electronic packet routing to highly predictable, energy-efficient optical connectivity.',
  '/portraits/vaysh-kewada.webp', 'Photo : Asians in Tech', '[{"label":"Lancement du commutateur 32 ports (DataCentreNews UK, mars 2026)","url":"https://datacentrenews.uk/story/salience-labs-debuts-all-optical-switch-for-ai-hubs"},{"label":"Levée de 30 M$ en série A (eeNews Europe, février 2025)","url":"https://www.eenewseurope.com/en/salience-labs-closes-funding-for-photonic-switches"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'uljan-sharka', 42, 'Uljan Sharka', 'Fondateur et directeur général', 'Founder and CEO',
  'Domyn', 'IT', 'infrastructures',
  'Il dirige Domyn, entreprise milanaise d''IA pour les secteurs régulés, dont le consortium a été choisi par la Commission européenne pour bâtir un modèle d''IA européen de pointe.', 'He leads Domyn, a Milan-based AI company for regulated sectors, whose consortium was chosen by the European Commission to build a leading European AI model.', 'Uljan Sharka a travaillé chez Apple avant de fonder l''entreprise d''IA qui s''appelait iGenius, rebaptisée Domyn en juin 2025. Installée à Milan, elle vise la finance, l''administration et l''industrie lourde.

En avril 2025, il annonce Colosseum, un supercalculateur (ordinateur très puissant) bâti avec NVIDIA dans le sud de l''Italie pour des usages réglementés.

Le 19 juin 2026, le consortium Europa, mené par Domyn, remporte le défi de la Commission européenne : un modèle ouvert de plus de 400 milliards de paramètres, dans les 24 langues de l''UE.', 'Uljan Sharka worked at Apple before founding the AI company then called iGenius, renamed Domyn in June 2025. Based in Milan, it targets finance, government and heavy industry.

In April 2025, he announced Colosseum, a supercomputer (a very powerful computer) built with NVIDIA in southern Italy for regulated uses.

On 19 June 2026, the Europa consortium, led by Domyn, won the European Commission''s challenge: an open model of more than 400 billion parameters, in the EU''s 24 languages.',
  'L''Europe peut développer, maîtriser et faire progresser en continu ses propres capacités d''IA de pointe.', 'Europe can develop, control and continuously advance its own frontier AI capabilities.',
  '/portraits/uljan-sharka.webp', 'Photo : Domyn', '[{"label":"Domyn - profil d''Uljan Sharka","url":"https://www.domyn.com/people/uljan-sharka"},{"label":"Domyn - site officiel","url":"https://domyn.com"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'alexandre-lebrun', 43, 'Alexandre LeBrun', 'PDG', 'CEO',
  'AMI Labs (Advanced Machine Intelligence)', 'FR', 'infrastructures',
  'Cofondateur de Nabla, ancien de Facebook AI Research, il dirige AMI Labs, le laboratoire parisien de Yann LeCun consacré aux « modèles du monde ».', 'Co-founder of Nabla and a Facebook AI Research alumnus, he runs AMI Labs, Yann LeCun''s Paris lab dedicated to "world models".', 'Polytechnicien, passé par Télécom Paris, Alexandre LeBrun fonde VirtuOz, revendue à Nuance en 2012, puis Wit.ai, rachetée par Facebook en 2015. Il dirige ensuite l''ingénierie de Facebook AI Research jusqu''en 2018.

Il cofonde alors Nabla, un assistant IA qui rédige les comptes rendus de consultation des médecins, utilisé par plus de 85 000 praticiens.

Fin 2025, il devient PDG d''AMI Labs, qui développe des « modèles du monde », des IA censées comprendre le monde physique. En mars 2026, la société lève 1,03 milliard de dollars.', 'An École Polytechnique graduate who also studied at Télécom Paris, Alexandre LeBrun founded VirtuOz, sold to Nuance in 2012, then Wit.ai, acquired by Facebook in 2015. He then led engineering at Facebook AI Research until 2018.

He then co-founded Nabla, an AI assistant that writes up doctors'' consultation notes, used by more than 85,000 clinicians.

In late 2025, he became CEO of AMI Labs, which builds "world models", AI meant to understand the physical world. In March 2026, the company raised $1.03 billion.',
  NULL, NULL,
  '/portraits/alexandre-lebrun.webp', 'Photo : Nabla', '[{"label":"AMI Labs","url":"https://amilabs.xyz"},{"label":"Nabla, équipe","url":"https://www.nabla.com/about-us"},{"label":"AMI Labs sur Wikipédia","url":"https://en.wikipedia.org/wiki/Advanced_Machine_Intelligence_Labs"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'zelda-mariet', 52, 'Zelda Mariet', 'Cofondatrice et vice-présidente de la recherche', 'Co-founder and VP of Research',
  'Bioptimus', 'FR', 'infrastructures',
  'Cofondatrice de Bioptimus, elle dirige la recherche de cette start-up parisienne qui entraîne des modèles de fondation pour la biologie, dont un modèle d''anatomopathologie.', 'Co-founder of Bioptimus, she leads research at this Paris start-up training foundation models for biology, including a pathology model.', 'Zelda Mariet est diplômée de l''École polytechnique, puis docteure en informatique du MIT. À partir de 2019, elle mène des recherches chez Google, sur l''incertitude des prédictions de l''IA, avec des applications à la découverte de médicaments.

En 2023, elle cofonde Bioptimus à Paris, dont elle dirige la recherche. La start-up entraîne des modèles de fondation, de grands modèles généralistes, pour lire des données biologiques.

En juillet 2024, Bioptimus lance H-Optimus-0, son premier modèle, dédié à l''anatomopathologie (l''analyse de tissus au microscope).', 'Zelda Mariet graduated from École polytechnique, then earned a PhD in computer science at MIT. Starting in 2019, she did research at Google on the uncertainty of AI predictions, with applications to drug discovery.

In 2023, she co-founded Bioptimus in Paris, where she leads research. The start-up trains foundation models, large general-purpose models, to read biological data.

In July 2024, Bioptimus launched H-Optimus-0, its first model, built for pathology (the study of tissue under the microscope).',
  NULL, NULL,
  '/portraits/zelda-mariet.webp', 'Photo : Académie des technologies', '[{"label":"Bioptimus - équipe","url":"https://www.bioptimus.com/team"},{"label":"Académie des technologies - Women in Tech","url":"https://www.academie-technologies.fr/en/woman-in-tech/mariet-zelda/"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'xavier-niel', 85, 'Xavier Niel', 'Fondateur et président du conseil d''administration', 'Founder and Chairman of the Board',
  'Iliad', 'FR', 'infrastructures',
  'Fondateur d''Iliad (Free), il finance en France cloud, centres de données et recherche ouverte en IA, avec Scaleway, le laboratoire Kyutai et une participation dans Mistral AI.', 'Founder of Iliad (Free), he backs cloud, data centers and open AI research in France through Scaleway, the Kyutai lab and an early stake in Mistral AI.', 'Né en 1967, Xavier Niel quitte les études à 19 ans, apprend seul la programmation et fonde Iliad, maison mère de Free. En 2013, il crée l''École 42, une école d''informatique gratuite.

Il a investi au départ dans Mistral AI, soutient Kyutai, laboratoire de recherche ouvert créé fin 2023, et Scaleway, le cloud d''Iliad.

Le 11 février 2025, avant le Sommet de l''IA à Paris, Iliad annonce 3 milliards d''euros d''investissements dans l''IA, dont 2,5 milliards pour des centres de données.', 'Born in 1967, Xavier Niel left school at 19, taught himself programming and founded Iliad, the parent company of Free. In 2013 he created École 42, a tuition-free coding school.

He was an early investor in Mistral AI and backs Kyutai, an open-science research lab created in late 2023, and Scaleway, Iliad''s cloud arm.

On 11 February 2025, ahead of the AI Action Summit in Paris, Iliad announced 3 billion euros of AI investment, including 2.5 billion for data centers.',
  NULL, NULL,
  '/portraits/xavier-niel.webp', 'Photo : cmichel67, CC BY 2.0, via Wikimedia Commons', '[{"label":"Groupe Iliad","url":"https://www.iliad.fr/en/group/governance"},{"label":"Kyutai","url":"https://kyutai.org/"},{"label":"Wikipédia","url":"https://fr.wikipedia.org/wiki/Xavier_Niel"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'anders-dam-jensen', 95, 'Anders Dam Jensen', 'Directeur exécutif', 'Executive Director',
  'Entreprise commune européenne pour le calcul à haute performance (EuroHPC JU)', 'LU', 'infrastructures',
  'Il dirige EuroHPC, l''organisme européen qui met des supercalculateurs à la disposition des chercheurs, des startups et des industriels, y compris pour développer l''IA.', 'He leads EuroHPC, the European body that provides supercomputers to researchers, startups and industry, including for developing AI.', 'Anders Dam Jensen est diplômé de l''Université technique du Danemark (master) et titulaire d''un MBA. Il débute comme ingénieur sur les réseaux sans fil chez Symbol Technologies, puis dirige l''informatique de la compagnie aérienne Cargolux. En 2011, il prend la direction des systèmes d''information de l''OTAN.

Depuis septembre 2020, il est directeur exécutif d''EuroHPC, l''entreprise commune européenne consacrée au calcul à haute performance, c''est-à-dire aux supercalculateurs.

En février 2025, la Commission européenne annonce InvestAI, une initiative de 200 milliards d''euros pour l''IA. EuroHPC supervise les « usines d''IA » : 19 sont recensées sur son site.', 'Anders Dam Jensen holds a master''s degree from the Technical University of Denmark and an MBA. He starts as an engineer working on wireless networks at Symbol Technologies, then runs IT at the airline Cargolux. In 2011, he becomes head of information systems at NATO.

Since September 2020, he has been Executive Director of EuroHPC, the European joint undertaking dedicated to high-performance computing, that is, supercomputers.

In February 2025, the European Commission announces InvestAI, a 200 billion euro initiative for AI. EuroHPC oversees the "AI Factories": 19 are listed on its website.',
  NULL, NULL,
  '/portraits/anders-dam-jensen.webp', 'Photo : EuroHPC JU', '[{"label":"Page du directeur exécutif, EuroHPC JU","url":"https://www.eurohpc-ju.europa.eu/executive-director_en"},{"label":"EuroHPC JU","url":"https://www.eurohpc-ju.europa.eu/index_en"},{"label":"Les usines d''IA (AI Factories)","url":"https://www.eurohpc-ju.europa.eu/ai-factories_en"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'daniel-ek', 13, 'Daniel Ek', 'Cofondateur et président', 'Co-founder and Chairman',
  'Neko Health', 'SE', 'industrialisation',
  'Fondateur de Spotify, il préside Neko Health, start-up suédoise de scanners corporels avec IA, et cofonde Prima Materia, société d''investissement dans les technologies européennes.', 'Founder of Spotify, he chairs Neko Health, a Swedish start-up building AI-assisted full-body scanners, and co-founded Prima Materia, an investment firm backing European technology.', 'Daniel Ek lance Spotify en octobre 2008 avec Martin Lorentzon. Il en est le directeur général jusqu''au 31 décembre 2025, puis en devient président exécutif.

En 2018, il cofonde Neko Health avec Hjalmar Nilsonne. La start-up propose un examen du corps entier, avec capteurs et analyse par IA, pour repérer tôt des risques comme le cancer de la peau.

En janvier 2025, Neko lève 260 millions de dollars, pour une valorisation de 1,8 milliard de dollars, et prépare son entrée sur le marché américain.', 'Daniel Ek launched Spotify in October 2008 with Martin Lorentzon. He was its CEO until 31 December 2025, then became executive chairman.

In 2018, he co-founded Neko Health with Hjalmar Nilsonne. The start-up offers a full-body check-up, using sensors and AI analysis, to spot risks such as skin cancer early.

In January 2025, Neko raised $260 million at a $1.8 billion valuation, and is preparing to enter the US market.',
  NULL, NULL,
  '/portraits/daniel-ek.webp', 'Photo : Lukasz Kobus/Commission européenne, CC BY 4.0, via Wikimedia Commons', '[{"label":"Daniel Ek sur Wikipédia","url":"https://en.wikipedia.org/wiki/Daniel_Ek"},{"label":"Neko Health","url":"https://www.nekohealth.com"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'mati-staniszewski', 14, 'Mati Staniszewski', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'ElevenLabs', 'GB', 'industrialisation',
  'Cofondateur et directeur général d''ElevenLabs, la société londonienne qui fait parler les machines : voix de synthèse, doublage et agents vocaux.', 'Co-founder and CEO of ElevenLabs, the London-based company that makes machines speak: synthetic voices, dubbing and voice agents.', 'Mati Staniszewski fait ses études secondaires à Varsovie, puis obtient un diplôme de mathématiques à l''Imperial College London. Il travaille chez Opera Software, chez BlackRock (plateforme Aladdin Wealth) et chez Palantir, comme stratège de déploiement.

En 2022, il fonde ElevenLabs avec son ami de lycée Piotr Dabkowski. L''entreprise développe des modèles audio, des outils de création et des agents conversationnels.

En février 2026, ElevenLabs lève 500 millions de dollars, pour une valorisation de 11 milliards, lors d''un tour mené par Sequoia.', 'Mati Staniszewski attends high school in Warsaw, then earns a mathematics degree at Imperial College London. He works at Opera Software, at BlackRock (Aladdin Wealth platform) and at Palantir, as a deployment strategist.

In 2022, he founds ElevenLabs with his high school friend Piotr Dabkowski. The company builds audio models, creative tools and conversational agents.

In February 2026, ElevenLabs raises 500 million dollars at an 11 billion valuation, in a round led by Sequoia.',
  'Ce financement nous aide à aller au-delà de la seule voix pour transformer notre façon d''interagir avec la technologie.', 'This funding helps us go beyond voice alone to transform how we interact with technology altogether.',
  '/portraits/mati-staniszewski.webp', 'Photo : Rafał Masłow, CC BY-SA 4.0, via Wikimedia Commons', '[{"label":"ElevenLabs","url":"https://elevenlabs.io/about"},{"label":"Wikipédia (en)","url":"https://en.wikipedia.org/wiki/Mati_Staniszewski"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'antoine-bordes', 16, 'Antoine Bordes', 'Directeur scientifique', 'Chief Scientist',
  'Helsing', 'FR', 'industrialisation',
  'Après neuf ans chez Meta, ce chercheur en IA dirige la science chez Helsing, entreprise européenne d''IA pour la défense, et plaide pour que l''humain garde la décision.', 'After nine years at Meta, this AI researcher leads science at Helsing, a European defence AI company, and argues that humans must keep the final decision.', 'Antoine Bordes est docteur en apprentissage statistique de l''université Pierre-et-Marie-Curie. Chercheur au CNRS, il reçoit en 2012 le prix de thèse de la Direction générale de l''armement (DGA).

Il rejoint Facebook AI Research en 2014 et reste neuf ans chez Meta. Il passe ensuite à la défense européenne : il est aujourd''hui directeur scientifique de Helsing, entreprise fondée en 2021 et basée à Munich.

En juin 2026, devant les élèves de l''École polytechnique, il défend l''IA comme une aide : la décision d''ouvrir le feu doit rester humaine.', 'Antoine Bordes holds a doctorate in statistical learning from Pierre and Marie Curie University. A researcher at CNRS, he won the French defence procurement agency (DGA) thesis prize in 2012.

He joined Facebook AI Research in 2014 and spent nine years at Meta. He then turned to European defence: he is now Chief Scientist at Helsing, a company founded in 2021 and based in Munich.

In June 2026, speaking to École Polytechnique students, he described AI as an aid: the decision to open fire must remain human.',
  'L''IA est très utile, y compris en défense, mais ce n''est qu''une aide : ce n''est pas à cet outil de décider d''ouvrir le feu.', 'AI is very useful, including in defence, but it is merely an aid; it should not be the one to decide to open fire.',
  '/portraits/antoine-bordes.webp', 'Photo : Jérémy Barande / École polytechnique', '[{"label":"Article de l''École polytechnique (juin 2026)","url":"https://www.polytechnique.edu/en/news/use-ai-military-must-serve-defend-our-european-democratic-values-antoine-bordes-ecole-polytechnique"},{"label":"Helsing","url":"https://helsing.ai"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'fabian-hedin', 19, 'Fabian Hedin', 'Cofondateur et directeur technique', 'Co-founder and CTO',
  'Lovable', 'SE', 'industrialisation',
  'Cofondateur et directeur technique de Lovable, la start-up suédoise qui permet de créer une application en décrivant son idée en langage courant.', 'Co-founder and CTO of Lovable, the Swedish start-up that lets anyone build an app by describing their idea in plain language.', 'Fabian Hedin est un ancien étudiant du KTH, à Stockholm. Il a fondé Tentium, dont il a été directeur général, et TenFAST, dont il a été directeur technique. Il a aussi dirigé le développement de l''interface utilisateur (frontend) chez Depict. Il cofonde Lovable avec Anton Osika.

Lovable permet de créer une application en décrivant son idée en langage courant, sans écrire de code. Fabian Hedin en est le directeur technique.

En août 2026, Lovable lève 400 millions de dollars, pour une valorisation de 13,3 milliards de dollars.', 'Fabian Hedin is a former student of KTH in Stockholm. He founded Tentium, where he was chief executive, and TenFAST, where he was chief technology officer. He also led frontend (user interface) development at Depict. He co-founded Lovable with Anton Osika.

Lovable lets people build an app by describing their idea in plain language, with no coding. Fabian Hedin is its chief technology officer.

In August 2026, Lovable raised $400 million at a $13.3 billion valuation.',
  'C''est formidable de voir le prix KTH Innovation et des initiatives similaires mettre en lumière les jeunes entrepreneurs suédois et inspirer plus de gens à concrétiser leurs idées.', 'It''s fantastic to see the KTH Innovation Award and similar initiatives shine a spotlight on young entrepreneurs in Sweden and inspire more people to pursue their ideas.',
  '/portraits/fabian-hedin.webp', 'Photo : Marcusgarage, CC0, via Wikimedia Commons', '[{"label":"Lovable","url":"https://lovable.dev"},{"label":"Lovable (Wikipédia)","url":"https://en.wikipedia.org/wiki/Lovable_(company)"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'alex-kendall', 20, 'Alex Kendall', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'Wayve', 'GB', 'industrialisation',
  'Cofondateur de Wayve, il fait conduire des voitures par une IA qui apprend des images, sans cartes détaillées, et la déploie depuis Londres.', 'Co-founder of Wayve, he has cars driven by an AI that learns from images, without detailed maps, and deploys it from London.', 'Né en Nouvelle-Zélande, Alex Kendall étudie l''ingénierie à Auckland, puis prépare à Cambridge un doctorat en apprentissage profond, vision par ordinateur et robotique. Il cofonde Wayve en 2017 et en devient directeur général en 2020.

Son approche : une seule IA apprend à conduire à partir des images, sans cartes détaillées de chaque ville. Il reçoit en 2025 la médaille d''argent de la Princesse Royale (Royal Academy of Engineering).

Le 25 février 2026, Wayve lève 1,2 milliard de dollars. Le 3 septembre 2026, avec Uber, elle lance à Londres des trajets supervisés.', 'Born in New Zealand, Alex Kendall studied engineering in Auckland, then did a PhD at Cambridge in deep learning, computer vision and robotics. He co-founded Wayve in 2017 and became CEO in 2020.

His approach: a single AI learns to drive from images, without detailed maps of each city. In 2025 he received the Royal Academy of Engineering''s Princess Royal Silver Medal.

On 25 February 2026, Wayve raised $1.2 billion. On 3 September 2026, with Uber, it launched supervised rides in London.',
  'Pour la première fois, nous verrons des machines intelligentes de confiance interagir physiquement avec notre monde, enrichir nos vies et nous libérer pour l''essentiel.', '',
  '/portraits/alex-kendall.webp', 'Photo : Wayve', '[{"label":"Profil sur Wayve","url":"https://wayve.ai/company/leadership-team/alex-kendall/"},{"label":"Wayve","url":"https://wayve.ai/press/"},{"label":"Article Wikipédia sur Wayve","url":"https://en.wikipedia.org/wiki/Wayve"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'jaroslaw-kutylowski', 23, 'Jaroslaw Kutylowski', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'DeepL', 'DE', 'industrialisation',
  'Il a fondé DeepL à Cologne en 2017, un traducteur par IA utilisé par des entreprises du monde entier, et le dirige aujourd''hui.', 'He founded DeepL in Cologne in 2017, an AI translator used by companies worldwide, and still leads it today.', 'Né en Pologne, Jarek Kutylowski grandit entre la Pologne et l''Allemagne. Il programme dès 10 ans, obtient un doctorat en informatique à l''université de Paderborn, passe par Vodafone, puis devient directeur technique de Linguee, un dictionnaire en ligne.

En 2017, il fonde DeepL à Cologne : un traducteur fondé sur des réseaux de neurones, des programmes qui apprennent à partir d''exemples, entraînés notamment avec les données de Linguee.

En novembre 2025, DeepL lance DeepL Agent, un assistant autonome pour l''entreprise. En avril 2026, sa traduction vocale passe à plus de 40 langues.', 'Born in Poland, Jarek Kutylowski grew up between Poland and Germany. He has coded since age 10, earned a PhD in computer science at the University of Paderborn, spent time at Vodafone, then became chief technology officer of Linguee, an online dictionary.

In 2017, he founded DeepL in Cologne: a translator built on neural networks, programs that learn from examples, trained partly on Linguee''s data.

In November 2025, DeepL launched DeepL Agent, an autonomous assistant for business. In April 2026, its voice translation expanded to more than 40 languages.',
  'Nous avons vu que la prochaine grande avancée de la traduction viendrait de l''IA et de l''apprentissage profond.', 'We saw the next big breakthrough in translation would come through AI and deep learning.',
  '/portraits/jaroslaw-kutylowski.webp', 'Photo : DeepL', '[{"label":"DeepL","url":"https://www.deepl.com"},{"label":"DeepL sur Wikipédia","url":"https://en.wikipedia.org/wiki/DeepL_SE"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'jan-oberhauser', 24, 'Jan Oberhauser', 'Fondateur et directeur général', 'Founder and CEO',
  'n8n', 'DE', 'industrialisation',
  'Ancien artiste d’effets visuels, il a fondé à Berlin n8n, plateforme qui relie des modèles d’IA aux outils des entreprises.', 'A former visual-effects artist, he founded n8n in Berlin, a platform that connects AI models to company tools.', 'Jan Oberhauser travaille des années dans les effets visuels, notamment sur Maléfique et Happy Feet 2. Il cherche à y simplifier le travail des artistes par l''automatisation.

Il fonde n8n à Berlin en 2019. L''outil enchaîne des étapes entre applications et modèles d''IA, avec peu de code. En octobre 2025, n8n lève 180 millions de dollars, pour une valorisation de 2,5 milliards.

En mai 2026, SAP entre au capital (valorisation : 5,2 milliards de dollars) et intègre n8n à Joule Studio, son outil de création d''agents IA.', 'Jan Oberhauser spent years in visual effects, including work on Maleficent and Happy Feet Two. There he sought to simplify the artists'' work through automation.

He founded n8n in Berlin in 2019. The tool chains steps between apps and AI models, with little code. In October 2025, n8n raised $180 million at a $2.5 billion valuation.

In May 2026, SAP joined the cap table (valuation: $5.2 billion) and is embedding n8n in Joule Studio, its AI agent-building tool.',
  NULL, NULL,
  '/portraits/jan-oberhauser.webp', 'Photo : n8n', '[{"label":"n8n","url":"https://n8n.io"},{"label":"Page auteur, blog n8n","url":"https://blog.n8n.io/author/jan/"},{"label":"n8n sur Wikipédia","url":"https://en.wikipedia.org/wiki/N8n"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'david-reger', 26, 'David Reger', 'Fondateur et directeur général', 'Founder and CEO',
  'NEURA Robotics', 'DE', 'industrialisation',
  'Fondateur de NEURA Robotics, il conçoit à Metzingen des robots « cognitifs » qui combinent capteurs et IA, du bras collaboratif à l''humanoïde 4NE1.', 'Founder of NEURA Robotics, he builds "cognitive" robots in Metzingen that combine sensors and AI, from collaborative arms to the 4NE1 humanoid.', 'Né en 1988 à Metzingen, David Reger se forme comme modeleur technique, sans études universitaires. Vers 2009, il travaille à San Francisco comme travailleur social, puis revient en Europe en 2013 pour des entreprises suisses d''automatisation et de robotique.

Il fonde NEURA Robotics en 2019. La société conçoit des robots dits cognitifs, dotés de capteurs et d''IA pour s''adapter à leur environnement, dont l''humanoïde 4NE1.

En juin 2026, NEURA annonce une levée pouvant atteindre 1,4 milliard de dollars, après 120 millions d''euros en série B en janvier 2025.', 'Born in 1988 in Metzingen, David Reger trained as a technical model maker and did not attend university. Around 2009 he worked as a social worker in San Francisco, then returned to Europe in 2013 to join Swiss automation and robotics firms.

He founded NEURA Robotics in 2019. The company builds so-called cognitive robots, fitted with sensors and AI so they can adapt to their surroundings, including the 4NE1 humanoid.

In June 2026, NEURA announced a funding round of up to 1.4 billion dollars, after a 120 million euro Series B in January 2025.',
  NULL, NULL,
  '/portraits/david-reger.webp', 'Photo : IFA Berlin', '[{"label":"NEURA Robotics - presse","url":"https://neura-robotics.com/press/"},{"label":"Wikipédia : David Reger","url":"https://en.wikipedia.org/wiki/David_Reger"},{"label":"Site de David Reger","url":"https://davidreger.com"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'loic-mougeolle', 27, 'Loïc Mougeolle', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'Comand AI', 'FR', 'industrialisation',
  'Ancien de Naval Group, il dirige Comand AI, start-up parisienne de logiciel d''aide au commandement militaire, qui a levé 32 millions d''euros en juin 2026.', 'A Naval Group alumnus, he runs Comand AI, a Paris start-up building military command software, which raised 32 million euros in June 2026.', 'Diplômé de HEC Paris, Loïc Mougeolle a dirigé l''incubateur d''innovations de rupture de Naval Group, le constructeur naval de défense français.

En 2023, il cofonde Comand AI avec Antoine Chassang, ancien de Snapchat. La start-up lève 3 millions d''euros en juillet 2023, puis 8,5 millions. Son logiciel, Prevail, aide les états-majors à établir des plans d''opérations, tâche qui peut prendre plusieurs heures à plusieurs jours.

Le 17 juin 2026, Comand AI annonce une série A de 32 millions d''euros menée par Blossom Capital, avec le groupe suédois Saab. Prevail est utilisé par des unités en France, en Allemagne et en Ukraine.', 'A graduate of HEC Paris, Loïc Mougeolle led the disruptive-innovation incubator at Naval Group, the French naval defence builder.

In 2023 he co-founded Comand AI with Antoine Chassang, a former Snapchat employee. The start-up raised 3 million euros in July 2023, then 8.5 million. Its software, Prevail, helps military staff draft operation plans, a task that can take several hours to several days.

On 17 June 2026, Comand AI announced a 32 million euro Series A led by Blossom Capital, with Swedish group Saab. Prevail is used by units in France, Germany and Ukraine.',
  NULL, NULL,
  NULL, NULL, '[{"label":"Comand AI","url":"https://www.comand.ai/"},{"label":"Annonce de la série A (Comand AI)","url":"https://www.comand.ai/news/comand-ai-raises-%E2%82%AC32-million-series-a-to-scale-ai-native-command-and-control-platform-across-nato"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'victor-riparbelli', 29, 'Victor Riparbelli', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'Synthesia', 'GB', 'industrialisation',
  'Cofondateur de Synthesia, il fait de la vidéo par avatars IA un outil de formation et de communication pour les entreprises.', 'Co-founder of Synthesia, he turns AI-avatar video into a training and communication tool for companies.', 'Danois, Victor Riparbelli étudie l''informatique à l''IT University de Copenhague et passe un semestre à Stanford. Installé à Londres, il rencontre le chercheur Matthias Niessner, auteur de travaux sur la génération vidéo par IA, et fonde Synthesia en 2017.

Le studio travaille d''abord pour le cinéma et la publicité. Vers 2021, de grandes entreprises demandent des vidéos de formation avec avatars : Synthesia en fait son cœur de métier.

En janvier 2026, elle lève 200 millions de dollars pour une valorisation de 4 milliards.', 'Danish-born Victor Riparbelli studies computer science at the IT University of Copenhagen and spends a semester at Stanford. Settled in London, he meets researcher Matthias Niessner, author of work on AI video generation, and founds Synthesia in 2017.

The studio first works for film and advertising. Around 2021, large companies ask for training videos with avatars: Synthesia makes that its core business.

In January 2026, it raises $200 million at a $4 billion valuation.',
  NULL, NULL,
  '/portraits/victor-riparbelli.webp', 'Photo : Duk3L1xon, CC BY-SA 4.0, via Wikimedia Commons', '[{"label":"Synthesia - équipe et à propos","url":"https://www.synthesia.io/about"},{"label":"Synthesia - annonce de la série E (janvier 2026)","url":"https://www.synthesia.io/post/series-e-200-million-4-billion-valuation-future-work"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'stanislas-polu', 31, 'Stanislas Polu', 'Cofondateur et directeur technique', 'Co-founder and CTO',
  'Dust', 'FR', 'industrialisation',
  'Cofondateur et directeur technique de Dust, plateforme française qui permet aux entreprises de créer des agents IA reliés à leurs données. Ancien chercheur d''OpenAI.', 'Co-founder and CTO of Dust, a French platform that lets companies build AI agents connected to their own data. Former OpenAI researcher.', 'Stanislas Polu étudie à Polytechnique et à Stanford. Il cofonde avec Gabriel Hubert une première start-up, spécialisée dans l''analyse de données Instagram, rachetée par Stripe, où il travaille cinq ans comme ingénieur.

Il rejoint ensuite l''équipe de recherche d''OpenAI et y passe trois ans sur le raisonnement mathématique des modèles de langage.

En janvier 2023, il lance Dust avec Gabriel Hubert : des assistants IA (agents) que les employés créent eux-mêmes, connectés à Slack, Notion ou GitHub. En mai 2026, Dust annonce une levée de 40 millions de dollars, menée par Abstract et Sequoia.', 'Stanislas Polu studied at Polytechnique and Stanford. With Gabriel Hubert he co-founded a first start-up, specialised in Instagram data analytics, which was acquired by Stripe, where he worked for five years as an engineer.

He then joined OpenAI''s research team and spent three years on the mathematical reasoning of language models.

In January 2023 he launched Dust with Gabriel Hubert: AI assistants (agents) that employees build themselves, connected to Slack, Notion or GitHub. In May 2026, Dust announced a $40 million round led by Abstract and Sequoia.',
  NULL, NULL,
  '/portraits/stanislas-polu.webp', 'Photo : Sequoia Capital', '[{"label":"Dust, équipe","url":"https://dust.tt/home/about"},{"label":"Tech.eu, levée de série B de Dust","url":"https://tech.eu/2026/05/18/dust-raises-40m-series-b-to-build-the-multiplayer-operating-system-for-enterprise-ai/"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'olivier-dellenbach', 33, 'Olivier Dellenbach', 'Président fondateur', 'Founder and Chairman',
  'ChapsVision', 'FR', 'industrialisation',
  'Fondateur d''eFront puis de ChapsVision, il bâtit un éditeur français de données et d''IA, dont la plateforme Argonos doit remplacer Palantir à la DGSI.', 'Founder of eFront, then of ChapsVision, he built a French data and AI software company whose Argonos platform is set to replace Palantir at the DGSI.', 'Polytechnicien, Olivier Dellenbach cofonde en 1987 l''éditeur de logiciels NAT Systèmes, revendu en 1998 au canadien Cognicase. En 1999, il fonde eFront (gestion de portefeuilles de capital-investissement), cédé en 2019 pour plus d''un milliard de dollars.

Il lance ChapsVision en 2019, éditeur de traitement de données et d''IA, qui compte 29 acquisitions. Il en est le président fondateur ; Silvano Sansoni dirige le groupe depuis novembre 2025.

Le 16 juin 2026, le Premier ministre annonce qu''Argonos, sa plateforme, remplacera progressivement Palantir à la DGSI.', 'A graduate of École Polytechnique, Olivier Dellenbach co-founded the software company NAT Systèmes in 1987, sold in 1998 to Canada''s Cognicase. In 1999 he founded eFront (private-equity portfolio management software), sold in 2019 for over one billion dollars.

He launched ChapsVision in 2019, a data-processing and AI software company that counts 29 acquisitions. He is its founding chairman; Silvano Sansoni has run the group since November 2025.

On 16 June 2026, the Prime Minister announced that Argonos, its platform, will progressively replace Palantir at the DGSI.',
  NULL, NULL,
  NULL, NULL, '[{"label":"ChapsVision, à propos","url":"https://www.chapsvision.com/fr/a-propos/"},{"label":"Wikipédia, Olivier Dellenbach","url":"https://fr.wikipedia.org/wiki/Olivier_Dellenbach"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'gautier-cloix', 34, 'Gautier Cloix', 'Directeur général', 'CEO',
  'H Company', 'FR', 'industrialisation',
  'Ancien de Palantir, il dirige H, société parisienne dont les agents d''IA utilisent un ordinateur comme un humain : cliquer, naviguer, remplir.', 'A Palantir alumnus, he leads H, a Paris company whose AI agents use a computer like a human would: clicking, browsing, filling in forms.', 'Diplômé de Centrale et du programme X-HEC Entrepreneurs, Gautier Cloix débute chez JPMorgan à Londres, puis se tourne vers l''entrepreneuriat social (On Purpose, Big Society Capital). En 2015, il rejoint Palantir, où il fonde et dirige le bureau français.

Il devient directeur général de H en juin 2025, après le départ de Charles Kantor. H développe des agents d''IA : des programmes qui pilotent un écran comme une personne, avec les modèles Holo.

En avril 2026, H propose Holo Tab, une extension Chrome gratuite pour les particuliers.', 'A graduate of Centrale and the X-HEC Entrepreneurs program, Gautier Cloix started at JPMorgan in London, then moved into social entrepreneurship (On Purpose, Big Society Capital). In 2015 he joined Palantir, where he founded and led the French office.

He became CEO of H in June 2025, after Charles Kantor left. H builds AI agents: programs that operate a screen like a person, using the Holo models.

In April 2026, H offers Holo Tab, a free Chrome extension for individuals.',
  'C''est exactement ce que fait un humain sur sa machine', 'It''s exactly what a human does on their machine',
  '/portraits/gautier-cloix.webp', 'Photo : HumanX', '[{"label":"H Company","url":"https://www.hcompany.ai/about"},{"label":"H (company) sur Wikipédia","url":"https://en.wikipedia.org/wiki/H_(company)"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'robin-tuluie', 35, 'Robin Tuluie', 'Fondateur et président du conseil d''administration', 'Founder and Chairman',
  'PhysicsX', 'GB', 'industrialisation',
  'Physicien de formation, il a dirigé la R&D en Formule 1 avant de fonder PhysicsX, qui applique l''IA à la simulation pour concevoir des machines industrielles.', 'A physicist by training, he led R&D in Formula 1 before founding PhysicsX, which applies AI to simulation to design industrial machines.', 'Physicien théoricien, Robin Tuluie a dirigé la R&D de Renault (Alpine) F1 et a été directeur scientifique de Mercedes F1. Il a aussi été directeur de la technologie véhicule chez Bentley Motors.

Il fonde PhysicsX avec Jacomo Corbo. La start-up britannique entraîne des IA sur des simulations physiques pour concevoir plus vite des pièces et des machines.

Le 8 juin 2026, elle annonce une levée de 300 millions de dollars, menée par Temasek, pour environ 2,4 milliards de dollars de valorisation.', 'A theoretical physicist, Robin Tuluie led R&D at Renault (Alpine) F1 and was Chief Scientist at Mercedes F1. He was also Vehicle Technology Director at Bentley Motors.

He founded PhysicsX with Jacomo Corbo. The British start-up trains AI on physics simulations to design parts and machines faster.

On 8 June 2026, it announced a $300 million funding round led by Temasek, at a valuation of about $2.4 billion.',
  'La simulation physique haute fidélité a toujours été puissante, mais aussi lente, coûteuse et réservée à un petit groupe de spécialistes.', 'High-fidelity physics simulation has always been powerful, but it has also been slow, costly, and the preserve of a small group of specialists.',
  '/portraits/robin-tuluie.webp', 'Photo : PhysicsX', '[{"label":"PhysicsX","url":"https://www.physicsx.ai/"},{"label":"Annonce de la série C (8 juin 2026)","url":"https://www.physicsx.ai/newsroom/physicsx-announces-300m-series-c-to-accelerate-physics-ai-for-industrial-engineering"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'mouad-m-ghari', 37, 'Mouad M''Ghari', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'Harmattan AI', 'FR', 'industrialisation',
  'Ancien de Polytechnique, de l''ENS et du MIT, il dirige Harmattan AI, qui conçoit des drones et logiciels autonomes pour la défense.', 'A graduate of École polytechnique, ENS and MIT, he leads Harmattan AI, which builds autonomous drones and software for defence.', 'Né à Rabat en 2000, Mouad M''Ghari grandit en Seine-et-Marne. Il passe par l''École polytechnique, l''ENS Ulm, puis un master au MIT (2022-2023).

En avril 2024, il fonde Harmattan AI avec cinq associés. L''entreprise conçoit des drones et des logiciels de défense autonomes, de la surveillance à la défense aérienne.

En janvier 2026, elle lève 200 millions de dollars, avec Dassault Aviation, pour une valorisation de 1,4 milliard de dollars. En juin 2026, la France lui commande 5 000 drones supplémentaires.', 'Born in Rabat in 2000, Mouad M''Ghari grew up in Seine-et-Marne. He studied at École polytechnique and ENS Ulm, then earned a master''s at MIT (2022-2023).

In April 2024, he founded Harmattan AI with five partners. The company builds autonomous defence drones and software, from surveillance to air defence.

In January 2026, it raised 200 million dollars, with Dassault Aviation, at a valuation of 1.4 billion dollars. In June 2026, France ordered 5,000 more drones from it.',
  NULL, NULL,
  NULL, NULL, '[{"label":"Harmattan AI, site officiel","url":"https://www.harmattan.ai"},{"label":"Harmattan AI sur Wikipédia","url":"https://fr.wikipedia.org/wiki/Harmattan_AI"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'jean-philippe-baert', 38, 'Jean-Philippe Baert', 'Directeur général', 'Chief Executive Officer',
  'LightOn', 'FR', 'industrialisation',
  'Ancien directeur général de Splio, il dirige depuis juillet 2026 LightOn, société cotée qui propose une plateforme d''IA générative aux entreprises et au secteur public.', 'Former CEO of Splio, he has led LightOn since July 2026, a listed company offering a generative AI platform to businesses and the public sector.', 'Plus de 30 ans dans le logiciel d''entreprise en abonnement (SaaS), avec des postes de direction chez ExactTarget, Salesforce, GE Digital, Mention Solution et Splio, dont il devient directeur général en mars 2024.

Le 9 juillet 2026, LightOn le nomme directeur général après la démission d''Igor Carron, cofondateur qui cumulait présidence et direction générale. Marie de Lauzon préside désormais le conseil.

Fondée en 2016 et cotée sur Euronext Growth Paris, LightOn propose une plateforme d''IA générative aux entreprises. Sa mission : accélérer le développement commercial.', 'Over 30 years in subscription-based enterprise software (SaaS), with leadership roles at ExactTarget, Salesforce, GE Digital, Mention Solution and Splio, where he became CEO in March 2024.

On 9 July 2026, LightOn named him CEO after the resignation of Igor Carron, a co-founder who held both the chair and CEO roles. Marie de Lauzon now chairs the board.

Founded in 2016 and listed on Euronext Growth Paris, LightOn offers a generative AI platform to businesses. His mission: speed up commercial growth.',
  NULL, NULL,
  NULL, NULL, '[{"label":"LightOn, relations investisseurs","url":"https://lighton.ai/investors"},{"label":"LightOn (site officiel)","url":"https://lighton.ai/"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'ralf-gulde', 39, 'Ralf Gulde', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'Sereact', 'DE', 'industrialisation',
  'Cofondateur de Sereact, à Stuttgart, il fournit aux robots un logiciel d''IA pour saisir des objets en entrepôt, sans fabriquer lui-même de robots.', 'Co-founder of Sereact in Stuttgart, he supplies robots with AI software to pick up objects in warehouses, without building robots himself.', 'Ralf Gulde étudie la mécatronique à l''université de Stuttgart, puis poursuit un doctorat à l''institut ISW, spécialisé dans la commande des machines de production. Il y côtoie Marc Tuscher, informaticien, qu''il connaît depuis l''école.

En 2021, les deux fondent Sereact. L''entreprise ne construit pas de robots : elle leur fournit un modèle d''IA, « Cortex », qui leur permet de saisir des objets et d''agir sans entraînement préalable, surtout en entrepôt.

En 2026, Sereact annonce une série B de 116 millions de dollars, rejointe par Zalando, et prévoit de s''étendre aux États-Unis.', 'Ralf Gulde studies mechatronics at the University of Stuttgart, then pursues a doctorate at the ISW institute, which specialises in controlling production machines. There he works alongside Marc Tuscher, a computer scientist he has known since school.

In 2021, the two found Sereact. The company does not build robots: it supplies them with an AI model, "Cortex", that lets them pick up objects and act without prior training, mainly in warehouses.

In 2026, Sereact announces a $116 million Series B, joined by Zalando, and plans to expand into the United States.',
  'Nous ne construisons pas de robots : nous leur donnons un cerveau.', 'We don''t build robots; we give them a brain.',
  '/portraits/ralf-gulde.webp', 'Photo : sereact / Marc Schultheiss', '[{"label":"Sereact","url":"https://sereact.ai"},{"label":"Université de Stuttgart : article sur Sereact","url":"https://www.student.uni-stuttgart.de/en/news/all/Start-up-sereact-is-making-robots-smarter-and-has-raised-110-million-dollars-in-funding/"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'ahmed-achchak', 40, 'Ahmed Achchak', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'Qevlar AI', 'FR', 'industrialisation',
  'Cofondateur de Qevlar AI, il fait enquêter des agents d''IA sur les alertes de cybersécurité, tâche que traitent aujourd''hui des analystes.', 'Co-founder of Qevlar AI, he has AI agents investigate cybersecurity alerts, a task that analysts handle today.', 'Ahmed Achchak a développé son expertise en apprentissage automatique et en ingénierie dans de grandes banques et des startups. Il cofonde ensuite Qevlar AI, à Paris, avec Hamza Sayah, directeur technique.

Sa cible : les centres d''opérations de sécurité (SOC), où des analystes trient les alertes informatiques. Les agents de Qevlar enquêtent seuls sur chaque alerte ; l''entreprise annonce une enquête ramenée à trois minutes.

En mars 2026, Qevlar lève 30 millions de dollars auprès de Partech et Forgepoint, avec EQT Ventures. Parmi ses clients : Mercedes-Benz, Sodexo, Orange Cyberdefense et Atos.', 'Ahmed Achchak built his expertise in machine learning and engineering at large banks and startups. He then co-founded Qevlar AI in Paris with Hamza Sayah, its chief technology officer.

His target: security operations centres (SOCs), where analysts sort through IT alerts. Qevlar''s agents investigate each alert on their own; the company says an investigation now takes three minutes.

In March 2026, Qevlar raised $30 million from Partech and Forgepoint, with EQT Ventures. Its customers include Mercedes-Benz, Sodexo, Orange Cyberdefense and Atos.',
  'On éteint l''incendie et on cherche ce qui l''a déclenché pour que cela ne se reproduise pas.', 'We''re putting out the fire and finding out what started it to make sure it doesn''t happen again.',
  '/portraits/ahmed-achchak.webp', 'Photo : Qevlar AI', '[{"label":"Qevlar AI","url":"https://www.qevlar.com"},{"label":"Qevlar AI, à propos","url":"https://www.qevlar.com/about"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'max-junestrand', 41, 'Max Junestrand', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'Legora', 'SE', 'industrialisation',
  'Il dirige Legora, start-up suédoise d''IA pour les avocats, valorisée 5,6 milliards de dollars en 2026 après sa série D.', 'He runs Legora, a Swedish AI start-up for lawyers, valued at $5.6 billion in 2026 after its Series D.', 'Max Junestrand cofonde Legora en 2023 à Stockholm, d''abord sous le nom de Leya. L''entreprise propose un espace de travail où l''IA assiste les juristes : recherche, revue de contrats, rédaction.

En mai 2025, elle lève 80 millions de dollars (série B) pour une valorisation de 675 millions. Ouverte en mars 2026, sa série D de 550 millions la valorise 5,55 milliards ; une extension la porte ensuite à 600 millions et 5,6 milliards.

En septembre 2026, Legora compte 2 100 cabinets et équipes juridiques clients dans plus de 80 pays, selon The Next Web.', 'Max Junestrand co-founded Legora in 2023 in Stockholm, first under the name Leya. The company offers a workspace where AI assists lawyers: research, contract review, drafting.

In May 2025, it raised $80 million (Series B) at a $675 million valuation. Opened in March 2026, its $550 million Series D valued it at $5.55 billion; an extension then brought it to $600 million and $5.6 billion.

In September 2026, Legora has 2,100 law firms and legal teams as customers in more than 80 countries, according to The Next Web.',
  NULL, NULL,
  '/portraits/max-junestrand.webp', 'Photo : Thomashollande, CC0, via Wikimedia Commons', '[{"label":"Legora","url":"https://legora.com"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'chad-edwards', 44, 'Chad Edwards', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'CuspAI', 'GB', 'industrialisation',
  'Chimiste devenu entrepreneur, il dirige CuspAI, qui utilise l''IA pour concevoir de nouveaux matériaux pour les puces, l''énergie et le climat.', 'A chemist turned entrepreneur, he runs CuspAI, which uses AI to design new materials for chips, energy and climate.', 'Chad Edwards est docteur en chimie et titulaire d''un MBA. Cofondateur commercial de Cambridge Quantum, il contribue à faire passer l''entreprise de 14 à 550 salariés avant sa fusion avec Honeywell dans Quantinuum. Il est aussi passé par Google Quantum AI et BASF.

Il cofonde CuspAI avec Max Welling. La société entraîne des modèles d''IA qui, à partir des propriétés voulues, proposent de nouveaux matériaux.

En juillet 2026, CuspAI lève 450 millions de dollars en série B.', 'Chad Edwards holds a PhD in chemistry and an MBA. As commercial co-founder of Cambridge Quantum, he helped the company grow from 14 to 550 staff before it merged with Honeywell to form Quantinuum. He also worked at Google Quantum AI and BASF.

He co-founded CuspAI with Max Welling. The company trains AI models that, starting from the properties wanted, propose new materials.

In July 2026, CuspAI raised $450 million in a Series B round.',
  NULL, NULL,
  '/portraits/chad-edwards.webp', 'Photo : London Tech Week / CuspAI', '[{"label":"CuspAI","url":"https://cusp.ai/"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'katy-wigdahl', 45, 'Katy Wigdahl', 'Directrice générale', 'Chief Executive Officer',
  'Speechmatics', 'GB', 'industrialisation',
  'Elle dirige Speechmatics, société de Cambridge qui transcrit la voix en texte dans plus de cinquante langues.', 'She runs Speechmatics, a Cambridge company that turns speech into text in more than fifty languages.', 'Katy Wigdahl rejoint Speechmatics en 2019 comme directrice financière, après plus de vingt-cinq ans dans la finance, notamment chez Unilever et Transversal. Sept mois plus tard, elle devient directrice générale.

Fondée en 2006 à Cambridge par le chercheur Tony Robinson, l''entreprise lève 62 millions de dollars en série B en juin 2022, puis lance le moteur Ursa (2023) et l''API Flow pour les échanges vocaux (2024).

En septembre 2025, Speechmatics annonce un modèle de transcription médicale qui atteint 93 % de précision en conditions réelles, selon l''entreprise.', 'Katy Wigdahl joins Speechmatics in 2019 as chief financial officer, after more than twenty-five years in finance, including at Unilever and Transversal. Seven months later, she becomes CEO.

Founded in Cambridge in 2006 by researcher Tony Robinson, the company raises $62 million in a Series B in June 2022, then launches the Ursa engine (2023) and the Flow API for voice interactions (2024).

In September 2025, Speechmatics announces a medical transcription model reaching 93% real-world accuracy, according to the company.',
  'Notre objectif est simple : construire une technologie vocale à laquelle les cliniciens peuvent se fier dans le désordre de la pratique réelle.', 'Our goal is simple: build speech tech clinicians can trust in the messiness of real-world practice.',
  '/portraits/katy-wigdahl.webp', 'Photo : Speechmatics', '[{"label":"Speechmatics, à propos","url":"https://www.speechmatics.com/company/about-speechmatics"},{"label":"Speechmatics sur Wikipédia","url":"https://en.wikipedia.org/wiki/Speechmatics"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'eleonore-crespo', 46, 'Eléonore Crespo', 'Cofondatrice et co-directrice générale', 'Co-founder and Co-CEO',
  'Pigment', 'FR', 'industrialisation',
  'Cofondatrice de Pigment, elle construit une plateforme de planification financière pour grandes entreprises, désormais dotée d''agents d''IA.', 'Co-founder of Pigment, she builds a financial planning platform for large companies, now equipped with AI agents.', 'Diplômée de l''ENS Paris-Saclay (2008) puis de l''École des Mines (2010), Éléonore Crespo est analyste financière chez Google, où elle conseille la direction sur la stratégie et le budget, puis investisseuse chez Index Ventures.

En 2019, elle cofonde Pigment avec Romain Niccoli, cofondateur de Criteo. Le logiciel aide les entreprises à bâtir budgets et prévisions au même endroit. Pigment lève 145 millions de dollars en avril 2024.

En mars 2025, Pigment lance un agent d''IA analyste. En septembre 2025, Éléonore Crespo reçoit le prix EY de la scale-up de l''année en Île-de-France.', 'A graduate of ENS Paris-Saclay (2008) and École des Mines (2010), Éléonore Crespo was a financial analyst at Google, advising leadership on strategy and budgeting, then an investor at Index Ventures.

In 2019, she co-founded Pigment with Romain Niccoli, co-founder of Criteo. The software helps companies build budgets and forecasts in one place. Pigment raised $145 million in April 2024.

In March 2025, Pigment launched an AI analyst agent. In September 2025, Éléonore Crespo received the EY Scale-Up of the Year award for Île-de-France.',
  'Les agents d''IA sont en réalité le contraire d''une boîte noire. Ils sont plus auditables qu''un être humain.', 'AI agents are actually the contrary of a black box. They are more auditable than a human being.',
  '/portraits/eleonore-crespo.webp', 'Photo : ENS Paris-Saclay Alumni', '[{"label":"Pigment","url":"https://www.pigment.com/about-us"},{"label":"Portrait, ENS Paris-Saclay Alumni","url":"https://alumni.ens-paris-saclay.fr/en/article/eleonore-crespo-founder-of-pigment-the-art-of-giving-meaning-to-data/01/08/2025/110"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'emmanuelle-martiano-rolland', 47, 'Emmanuelle Martiano-Rolland', 'Cofondatrice et directrice des opérations', 'Co-founder and COO',
  'Aqemia', 'FR', 'industrialisation',
  'Cofondatrice et directrice des opérations d''Aqemia, elle bâtit à Paris et Londres une entreprise qui conçoit des médicaments avec une IA fondée sur la physique.', 'Co-founder and COO of Aqemia, she is building a company in Paris and London that designs drugs with physics-based AI.', 'Ingénieure de CentraleSupélec, titulaire d''un master de l''Imperial College London, Emmanuelle Martiano-Rolland a été Principal au Boston Consulting Group, auprès de dirigeants de la pharmacie et du logiciel.

Elle cofonde Aqemia en 2019 avec Maximilien Levesque et dirige les opérations. L''entreprise, à Paris et Londres, associe IA générative et physique pour concevoir des petites molécules, les médicaments classiques non biologiques.

En juillet 2026, Aqemia élargit sa collaboration avec Sanofi : une nouvelle cible est désignée, pour jusqu''à 140 M$ de paiements possibles.', 'An engineer from CentraleSupélec with a master''s from Imperial College London, Emmanuelle Martiano-Rolland was a Principal at Boston Consulting Group, working with pharma and software executives.

She co-founded Aqemia in 2019 with Maximilien Levesque and runs operations. The company, in Paris and London, combines generative AI and physics to design small molecules, the classic non-biological drugs.

In July 2026, Aqemia expanded its collaboration with Sanofi: a new target was nominated, with up to $140 million in potential payments.',
  NULL, NULL,
  '/portraits/emmanuelle-martiano-rolland.webp', 'Photo : Aqemia', '[{"label":"Aqemia - Qui sommes-nous","url":"https://www.aqemia.com/who-we-are"},{"label":"Aqemia","url":"https://www.aqemia.com"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'vishal-marria', 48, 'Vishal Marria', 'Fondateur et directeur général', 'Founder and CEO',
  'Quantexa', 'GB', 'industrialisation',
  'Cofondateur de Quantexa, à Londres : sa plateforme relie des données éparses pour aider banques et États à repérer fraude et risques.', 'Co-founder of London-based Quantexa, whose platform connects scattered data to help banks and governments spot fraud and risk.', 'Vishal Marria grandit à Londres. Diplômé de Royal Holloway (université de Londres), il travaille chez Detica, SAS puis EY, où il devient le plus jeune directeur exécutif, sur la lutte contre la criminalité financière dans les banques.

Il cofonde Quantexa en 2016. Le logiciel relie des données dispersées pour donner du contexte aux décisions : détecter une fraude, évaluer un risque.

En mars 2025, l''entreprise lève 175 millions de dollars, valorisée 2,6 milliards. En janvier 2026, Gartner la classe parmi les leaders des plateformes d''aide à la décision.', 'Vishal Marria grew up in London. A Royal Holloway (University of London) graduate, he worked at Detica, SAS and then EY, where he became the youngest Executive Director, on financial crime programs at banks.

He co-founded Quantexa in 2016. Its software links scattered data to give decisions context: spotting fraud, assessing risk.

In March 2025, the company raised $175 million at a $2.6 billion valuation. In January 2026, Gartner named it a Leader among decision intelligence platforms.',
  'Entourez-vous de gens en qui vous avez confiance et qui croient en votre vision. Et surtout : concentration, concentration, concentration.', 'Hire and surround yourself with people you trust and who believe in your vision. Plus… focus, focus, focus.',
  '/portraits/vishal-marria.webp', 'Photo : Quantexa', '[{"label":"Profil sur le site de Quantexa","url":"https://www.quantexa.com/team/vishal-marria/"},{"label":"Quantexa (Wikipédia)","url":"https://en.wikipedia.org/wiki/Quantexa"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'glen-gowers', 49, 'Glen Gowers', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'Basecamp Research', 'GB', 'industrialisation',
  'Cofondateur et directeur général de Basecamp Research, laboratoire londonien qui conçoit des médicaments avec l''IA à partir de données génétiques collectées dans la nature.', 'Co-founder and CEO of Basecamp Research, a London lab that designs medicines with AI using genetic data collected from nature.', 'Glen Gowers étudie à l''université d''Oxford, puis obtient un doctorat en ingénierie biologique à l''Imperial College London et débute chez GSK. Avec Oliver Vince, il réalise le premier séquençage d''ADN hors réseau sur la plus grande calotte glaciaire d''Europe.

Cette expédition mène à Basecamp Research, qui collecte des données génétiques dans la nature pour entraîner des IA de conception de médicaments. En 2024, elle s''associe au laboratoire de David Liu (Broad Institute).

Le 23 septembre 2026, elle annonce 140 millions de dollars levés, menés par S32, avec NVentures (Nvidia) et l''Anthology Fund (Menlo Ventures et Anthropic). Total : 225 millions.', 'Glen Gowers studied at the University of Oxford, then earned a PhD in engineering biology at Imperial College London and started out at GSK. With Oliver Vince, he carried out the first off-grid DNA sequencing on Europe''s largest ice cap.

That expedition led to Basecamp Research, which gathers genetic data from nature to train AI models that design medicines. In 2024, it partnered with David Liu''s lab at the Broad Institute.

On 23 September 2026, it announced a $140 million round led by S32, with NVentures (Nvidia) and the Anthology Fund (Menlo Ventures and Anthropic). Total raised: $225 million.',
  NULL, NULL,
  '/portraits/glen-gowers.webp', 'Photo : Basecamp Research', '[{"label":"Basecamp Research","url":"https://www.basecamp-research.com"},{"label":"Équipe - Basecamp Research","url":"https://www.basecamp-research.com/about"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'delphine-groll', 50, 'Delphine Groll', 'Cofondatrice et directrice des opérations', 'Co-founder and Chief Operating Officer',
  'Nabla', 'FR', 'industrialisation',
  'Cofondatrice et directrice des opérations de Nabla, elle déploie auprès des soignants un assistant IA qui rédige les comptes rendus de consultation.', 'Co-founder and COO of Nabla, she rolls out to clinicians an AI assistant that writes up consultation notes.', 'Avant Nabla, Delphine Groll travaille dans le développement commercial chez My Little Paris, puis dans la communication chez Auféminin.

Elle cofonde Nabla avec Alexandre Lebrun et Martin Raison. Leur assistant écoute la consultation et rédige le compte rendu, pour que les soignants écrivent moins.

En juin 2025, Nabla lève 70 millions de dollars en série C, menée par HV Capital. En 2026, HumanX cite plus de 40 millions de consultations prises en charge par an.', 'Before Nabla, Delphine Groll worked in business development at My Little Paris, then in communications at Auféminin.

She co-founded Nabla with Alexandre Lebrun and Martin Raison. Their assistant listens to the consultation and writes the medical note, so clinicians write less.

In June 2025, Nabla raised $70 million in a Series C led by HV Capital. In 2026, HumanX cites more than 40 million patient encounters a year.',
  NULL, NULL,
  '/portraits/delphine-groll.webp', 'Photo : Nabla', '[{"label":"Nabla, équipe dirigeante","url":"https://www.nabla.com/about-us"},{"label":"HumanX, profil","url":"https://www.humanx.co/speakers/delphine-groll"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'sasha-haco', 51, 'Sasha Haco', 'Cofondatrice et directrice générale', 'Co-founder and CEO',
  'Unitary', 'GB', 'industrialisation',
  'Docteure en physique de Cambridge, elle dirige Unitary, qui déploie des agents d''IA dans les logiciels existants des entreprises, notamment des assureurs.', 'A Cambridge-trained doctor of physics, she runs Unitary, which deploys AI agents inside companies'' existing software, notably for insurers.', 'Sasha Haco fait un doctorat de physique théorique à Cambridge et travaille avec Stephen Hawking sur le paradoxe de l''information des trous noirs. En 2019, elle rejoint Entrepreneur First, y rencontre James Thewlis et cofonde Unitary à Londres.

Unitary débute dans la modération de contenus en ligne. En octobre 2023, la société lève 15 millions de dollars en série A, menée par Creandum.

En octobre 2025, elle lance des « agents virtuels » pour l''assurance : ils travaillent dans les logiciels existants, sans intégration technique ni changement de processus.', 'Sasha Haco did a PhD in theoretical physics at Cambridge, working with Stephen Hawking on the black hole information paradox. In 2019, she joined Entrepreneur First, met James Thewlis there and co-founded Unitary in London.

Unitary started in online content moderation. In October 2023, the company raised $15 million in a Series A led by Creandum.

In October 2025, it launched "virtual agents" for insurance: they work inside existing software, with no technical integration or change to processes.',
  'Les agents virtuels ne demandent ni intégration technique ni changement des processus existants, et apportent très vite une vraie valeur.', 'Virtual Agents require no engineering integration or changes to existing processes while delivering real value, incredibly quickly.',
  '/portraits/sasha-haco.webp', 'Photo : Unitary', '[{"label":"Unitary","url":"https://www.unitary.ai"},{"label":"Sasha Haco, page équipe Unitary","url":"https://www.unitary.ai/about-us"},{"label":"Sasha Haco sur Wikipédia","url":"https://en.wikipedia.org/wiki/Sasha_Haco"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'nicolas-do-huu', 53, 'Nicolas Do Huu', 'Cofondateur et directeur technique', 'Co-founder and Chief Technology Officer',
  'Iktos', 'FR', 'industrialisation',
  'Cofondateur d''Iktos, il dirige la technologie d''une entreprise parisienne qui associe IA générative et robots de laboratoire pour concevoir plus vite de nouveaux médicaments.', 'Co-founder of Iktos, he leads the technology of a Paris-based company that pairs generative AI with lab robots to design new medicines faster.', 'Docteur en chimie organique du MIT et titulaire d''un MBA de la Stern School of Business (New York University), Nicolas Do Huu a travaillé en recherche pharmaceutique, en investissement et en direction d''entreprise. Il a déposé plus de 20 brevets. Il cofonde Iktos en 2016.

Iktos conçoit des molécules avec l''IA générative, puis les fait synthétiser par des robots. Elle compte plus de 60 projets menés avec des partenaires.

En janvier 2026, elle signe avec Servier un accord pluriannuel pouvant dépasser 1 milliard d''euros, versements d''étape compris.', 'Nicolas Do Huu holds a PhD in organic chemistry from MIT and an MBA from NYU''s Stern School of Business. He has worked in pharmaceutical research, investment and company leadership, and has filed more than 20 patents. He co-founded Iktos in 2016.

Iktos designs molecules with generative AI, then has robots synthesize them. It has run more than 60 projects with partners.

In January 2026, it signed a multi-year agreement with Servier that could exceed 1 billion euros, milestone payments included.',
  NULL, NULL,
  '/portraits/nicolas-do-huu.webp', 'Photo : Iktos', '[{"label":"Iktos - équipe","url":"https://iktos.ai/about"},{"label":"Iktos - site officiel","url":"https://iktos.ai"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'eleanor-lightbody', 54, 'Eleanor Lightbody', 'Directrice générale', 'Chief Executive Officer',
  'Luminance', 'GB', 'industrialisation',
  'Directrice générale de Luminance, éditeur britannique d''IA juridique né à Cambridge, utilisé par plus de 1 000 entreprises dans plus de 70 pays.', 'CEO of Luminance, a British legal AI company born in Cambridge and used by more than 1,000 enterprises in over 70 countries.', 'Eleanor Lightbody travaille d''abord chez Darktrace, spécialiste de la cybersécurité par IA. Elle y fonde et développe l''activité en Afrique, puis dirige la division industrielle à l''échelle mondiale.

Elle prend ensuite la tête de Luminance, issue de l''université de Cambridge, dont les outils analysent des contrats. Elle conduit la série B de 40 millions de dollars en 2024 ; la série C de 75 millions suit en février 2025.

En 2025, le chiffre d''affaires mondial de Luminance double et l''entreprise traite plus de 18 millions de contrats. En mai 2026, elle reçoit le King''s Award for Enterprise pour son commerce international.', 'Eleanor Lightbody first works at Darktrace, an AI cybersecurity company. There she founds and grows the business in Africa, then heads its industrial division globally.

She then leads Luminance, a University of Cambridge spin-out whose tools analyse contracts. She leads the $40 million Series B in 2024; the $75 million Series C follows in February 2025.

In 2025, Luminance''s global revenue doubles and the company processes more than 18 million contracts. In May 2026, it receives the King''s Award for Enterprise for international trade.',
  'Notre croissance internationale repose sur une seule chose : une IA sur laquelle tous les juristes, des grands cabinets aux équipes d''entreprise, peuvent vraiment compter.', 'Our international growth has been built on one thing: AI that all legal professionals, from big law to enterprise teams, can actually rely on.',
  '/portraits/eleanor-lightbody.webp', 'Photo : MIT Technology Review EmTech AI', '[{"label":"Luminance","url":"https://www.luminance.com"},{"label":"Luminance : prix Tech Businesswoman of the Year 2025","url":"https://www.luminance.com/press-releases/luminance-ceo-eleanor-lightbody-named-tech-businesswoman-of-the-year-at-the-2025-uk-tech-awards"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'maik-taro-wehmeyer', 55, 'Maik Taro Wehmeyer', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'Taktile', 'DE', 'industrialisation',
  'Cofondateur de Taktile, plateforme d''IA qui aide banques et assureurs à automatiser leurs décisions à fort enjeu : crédit, fraude, sinistres.', 'Co-founder of Taktile, an AI platform that helps banks and insurers automate high-stakes decisions such as credit, fraud and claims.', 'Maik Taro Wehmeyer dirige Taktile, fondée en 2020 avec Maximilian Eber. La plateforme aide banques et assureurs à confier à des agents d''IA des décisions sensibles : ouverture de compte, crédit, lutte contre la fraude, traitement des sinistres.

Il est membre de l''AI Alliance de la Commission européenne et membre fondateur de l''association allemande de l''IA.

En juin 2026, Taktile a levé 110 millions de dollars en série C, menée par Goldman Sachs Alternatives, pour se développer aux États-Unis, en EMEA et en Amérique latine.', 'Maik Taro Wehmeyer runs Taktile, founded in 2020 with Maximilian Eber. The platform helps banks and insurers hand sensitive decisions to AI agents: account opening, credit, fraud prevention, claims processing.

He is a member of the European Commission''s AI Alliance and a founding member of the German AI Association.

In June 2026, Taktile raised $110 million in a Series C led by Goldman Sachs Alternatives, to expand in the United States, EMEA and Latin America.',
  'Les outils d''IA généralistes suffisent pour des automatisations simples, pas pour des décisions financières critiques où une erreur peut coûter des millions.', 'General purpose AI tooling is fine for simple automations, but it isn''t sufficient for operating mission-critical financial decisions where errors can cost millions.',
  '/portraits/maik-taro-wehmeyer.webp', 'Photo : Taktile', '[{"label":"Taktile","url":"https://taktile.com"},{"label":"Profil sur taktile.com","url":"https://taktile.com/maik-taro-wehmeyer"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'elise-de-reus', 56, 'Elise de Reus', 'Cofondatrice', 'Co-founder',
  'Cradle', 'NL', 'industrialisation',
  'Cofondatrice de Cradle, qui aide les biologistes à concevoir des protéines avec l''IA générative pour accélérer la recherche en santé et dans l''industrie.', 'Co-founder of Cradle, which helps biologists design proteins with generative AI to speed up research in health and industry.', 'Elise de Reus est titulaire d''un master en ingénierie métabolique de TU Delft et d''un doctorat en biologie synthétique fongique de DTU. Elle travaille ensuite chez Zymergen et Perfect Day, en Californie, sur des méthodes à haut débit pour modifier des micro-organismes.

En 2021, elle cofonde Cradle à Amsterdam. Une protéine est une molécule dont la séquence détermine la fonction : Cradle emploie l''apprentissage automatique pour aider les biologistes à en concevoir.

Le 26 novembre 2024, Cradle annonce une série B de 73 M$ menée par IVP, avec plus de 21 clients, dont Novo Nordisk et Grifols.', 'Elise de Reus holds a master''s degree in metabolic engineering from TU Delft and a PhD in fungal synthetic biology from DTU. She then works at Zymergen and Perfect Day, in California, on high-throughput methods to engineer microorganisms.

In 2021, she co-founds Cradle in Amsterdam. A protein is a molecule whose sequence determines its function: Cradle uses machine learning to help biologists design them.

On 26 November 2024, Cradle announces a $73M Series B led by IVP, with more than 21 customers, including Novo Nordisk and Grifols.',
  NULL, NULL,
  '/portraits/elise-de-reus.webp', 'Photo : Techleap / Elise de Reus', '[{"label":"Cradle","url":"https://www.cradle.bio"},{"label":"Annonce de la série B","url":"https://www.cradle.bio/blog/series-b"},{"label":"Cradle (Wikipédia)","url":"https://en.wikipedia.org/wiki/Cradle_(company)"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'matthieu-rouif', 57, 'Matthieu Rouif', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'Photoroom', 'FR', 'industrialisation',
  'Il dirige Photoroom, l''application parisienne qui retouche et génère des images de produits par IA pour les commerçants en ligne.', 'He runs Photoroom, the Paris-based app that edits and generates product images with AI for online sellers.', 'Matthieu Rouif travaille dans les applications de photo et de vidéo dès 2014, chez Stupeflix, rachetée par GoPro en 2016. Il y est responsable des applications de retouche photo, puis fonde Photoroom en 2019 avec Eliot Andres.

En mars 2024, l''entreprise lève 43 millions de dollars auprès de Balderton Capital et Aglaé Ventures, pour une valorisation de 500 millions. En juin 2026, elle indique traiter 7 milliards d''images par an pour plus d''un million d''entreprises.', 'Matthieu Rouif worked on photo and video apps from 2014 at Stupeflix, which GoPro acquired in 2016. There he was in charge of the photo editing apps, then founded Photoroom in 2019 with Eliot Andres.

In March 2024, the company raised $43 million from Balderton Capital and Aglaé Ventures, at a $500 million valuation. In June 2026, it said it processes 7 billion images a year for over a million businesses.',
  'L''idée de PhotoRoom est de rendre les photos de qualité studio accessibles à tous, partout dans le monde.', 'The idea of PhotoRoom is to make studio quality photos accessible to everyone in the world.',
  '/portraits/matthieu-rouif.webp', 'Photo : Photoroom', '[{"label":"Photoroom","url":"https://www.photoroom.com/about"},{"label":"Article de Matthieu Rouif sur le blog Photoroom","url":"https://www.photoroom.com/inside-photoroom/brand-refresh"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'neil-daly', 58, 'Neil Daly', 'Fondateur et directeur général', 'Founder and CEO',
  'Skin Analytics', 'GB', 'industrialisation',
  'Fondateur de Skin Analytics, il déploie dans le système de santé britannique une IA qui détecte le cancer de la peau sans relecture médicale.', 'Founder of Skin Analytics, he brings to the UK health system an AI that detects skin cancer without a doctor reviewing each case.', 'Neil Daly grandit en Australie. Il étudie la physique et les mathématiques à l''Université d''Australie-Occidentale, travaille comme consultant, puis comme directeur au GSMA, où il contribue à l''essor de la banque mobile. Après un MBA exécutif à la London Business School, il fonde Skin Analytics en 2012.

Son outil, DERM, détecte le cancer de la peau. Il a reçu un marquage CE de classe III et il est présenté comme la première IA autorisée à décider seule, sans relecture médicale.

En avril 2025, l''entreprise lève 15 millions de livres sterling pour s''étendre en Europe, en Australie et aux États-Unis.', 'Neil Daly grew up in Australia. He studied physics and mathematics at the University of Western Australia, worked as a consultant, then as a director at the GSMA, where he helped build the mobile banking industry. After an Executive MBA at London Business School, he founded Skin Analytics in 2012.

Its tool, DERM, detects skin cancer. It received a Class III CE mark and is presented as the first AI cleared to decide on its own, without a doctor''s review.

In April 2025, the company raised 15 million pounds sterling to expand in Europe, Australia and the United States.',
  'L''IA nous permet de passer d''un monde de pénurie de spécialistes à un monde où nous pouvons voir toute personne inquiète pour sa peau.', '',
  '/portraits/neil-daly.webp', 'Photo : COGX / Skin Analytics', '[{"label":"Page de Neil Daly sur Skin Analytics","url":"https://skin-analytics.com/about-us/"},{"label":"Annonce de la série B","url":"https://skin-analytics.com/news/funding/series-b-15million-funding/"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'james-field', 59, 'James Field', 'Fondateur et directeur général', 'Founder and CEO',
  'LabGenius Therapeutics', 'GB', 'industrialisation',
  'Ingénieur en protéines, il a fondé à Londres LabGenius, qui conçoit par IA des anticorps contre les tumeurs solides, avec des partenaires comme Sanofi et LG Chem.', 'A protein engineer, he founded LabGenius in London, which uses AI to design antibodies against solid tumours, with partners such as Sanofi and LG Chem.', 'James Field est ingénieur en protéines de formation. Il fonde LabGenius pendant son doctorat à l''Imperial College London.

Aujourd''hui, l''entreprise londonienne conçoit des anticorps multispécifiques, capables de viser plusieurs cibles à la fois, contre les tumeurs solides. Sa plateforme EVA associe apprentissage automatique et expérimentation : jusqu''à 3 000 candidats sont clonés, produits et purifiés par cycle, dont la durée est inférieure à six semaines.

Le 18 juin 2026, LabGenius signe avec le groupe coréen LG Chem un accord de collaboration de recherche, d''option et de licence. Le 4 décembre 2025, elle avait annoncé une collaboration élargie avec Sanofi.', 'James Field trained as a protein engineer. He founded LabGenius during his PhD at Imperial College London.

Today, the London company designs multispecific antibodies, able to target several targets at once, against solid tumours. Its EVA platform combines machine learning and experimentation: up to 3,000 candidates are cloned, produced and purified per cycle, which lasts under six weeks.

On 18 June 2026, LabGenius signed a research collaboration, option and licence agreement with Korea''s LG Chem. On 4 December 2025, it had announced an expanded collaboration with Sanofi.',
  'S''associer à LG Chem est un moment très important pour LabGenius et valide à nouveau la capacité de notre plateforme à concevoir des anticorps multispécifiques très optimisés.', 'Partnering with LG Chem represents a very important moment for LabGenius and provides further validation of our platform''s ability to design highly optimised multispecific antibodies.',
  '/portraits/james-field.webp', 'Photo : LabGenius Therapeutics', '[{"label":"LabGenius Therapeutics","url":"https://labgeniustx.com/"},{"label":"Équipe LabGenius","url":"https://labgeniustx.com/team"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'nora-khaldi', 60, 'Nora Khaldi', 'Fondatrice et directrice générale', 'Founder and CEO',
  'Nuritas', 'IE', 'industrialisation',
  'Mathématicienne, elle a fondé Nuritas à Dublin en 2014 : la biotech utilise l''IA pour découvrir dans les plantes des peptides bénéfiques pour la santé.', 'A mathematician, she founded Nuritas in Dublin in 2014. The biotech uses AI to discover health-benefiting peptides in plants.', 'Nora Khaldi est mathématicienne, docteure en évolution moléculaire et bioinformatique. Elle fonde Nuritas à Dublin en 2014.

La société utilise l''IA pour repérer, dans les protéines végétales, des peptides (de courtes chaînes d''acides aminés) aux effets sur la santé. En 2018, avec BASF, elle lance PeptAIde, un ingrédient anti-inflammatoire tiré de la protéine de riz.

Le 10 septembre 2026, Nuritas nomme Kees Kruythoff, ancien président d''Unilever Amérique du Nord, à la présidence de son conseil d''administration.', 'Nora Khaldi is a mathematician with a PhD in molecular evolution and bioinformatics. She founded Nuritas in Dublin in 2014.

The company uses AI to spot, in plant proteins, peptides (short chains of amino acids) with effects on health. In 2018, with BASF, it launched PeptAIde, an anti-inflammatory ingredient drawn from rice protein.

On 10 September 2026, Nuritas named Kees Kruythoff, former president of Unilever North America, as Chair of its board.',
  'Son expérience pour construire des marchés et ancrer santé et durabilité dans de grands groupes de consommation fait de lui le partenaire idéal pour Nuritas en ce moment.', '',
  '/portraits/nora-khaldi.webp', 'Photo : Nuritas', '[{"label":"Nuritas : page équipe (Nora Khaldi)","url":"https://www.nuritas.com/about/"},{"label":"Nuritas","url":"https://www.nuritas.com/"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'lukas-saari', 61, 'Lukas Saari', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'Tandem Health', 'SE', 'industrialisation',
  'Cofondateur et directeur général de Tandem Health, assistant IA qui rédige les notes de consultation des soignants, utilisé par 10 000 organisations de soins en Europe.', 'Co-founder and CEO of Tandem Health, an AI assistant that writes clinicians'' consultation notes, used by 10,000 care organisations in Europe.', 'Lukas Saari a dirigé la pratique IA et numérique nordique de McKinsey et travaillé sur l''apprentissage automatique chez Spotify. Il cofonde Tandem Health avec Oscar Boldt-Christmas et Oliver Åstrand.

Le constat, selon Tandem : le travail administratif occupe environ 40 % du temps clinique. Son outil rédige les notes de consultation et suggère des codes de diagnostic (CIM-10, SNOMED).

Le 14 septembre 2026, l''entreprise annonce une série B de 100 M$, menée par le Scaleup Europe Fund géré par EQT. Elle sert 10 000 organisations de soins dans 14 marchés européens.', 'Lukas Saari led McKinsey''s Nordic AI and digitization practice and worked on machine learning at Spotify. He co-founded Tandem Health with Oscar Boldt-Christmas and Oliver Åstrand.

The problem, according to Tandem: administrative work takes up about 40% of clinical time. Its tool writes consultation notes and suggests diagnosis codes (ICD-10, SNOMED).

On 14 September 2026, the company announced a $100M Series B led by the Scaleup Europe Fund, managed by EQT. It serves 10,000 care organisations across 14 European markets.',
  'L''Europe devrait fixer la norme pour l''entrée de l''IA dans la santé, plutôt que d''adopter celle d''un autre.', 'Europe should be setting the standard for how AI enters healthcare, not adopting someone else’s.',
  '/portraits/lukas-saari.webp', 'Photo : Tandem Health', '[{"label":"Tandem Health, à propos","url":"https://www.tandemhealth.ai/about"},{"label":"Tandem Health, actualités","url":"https://www.tandemhealth.ai/news"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'marius-meiners', 62, 'Marius Meiners', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'Peec AI', 'DE', 'industrialisation',
  'Cofondateur et directeur général de Peec AI, à Berlin, il aide les marques à mesurer leur visibilité dans les réponses de ChatGPT, Perplexity et Gemini.', 'Co-founder and CEO of Peec AI in Berlin, he helps brands measure their visibility in the answers of ChatGPT, Perplexity and Gemini.', 'Marius Meiners rencontre ses cofondateurs, Daniel Drabo et Tobias Siwonia, dans la promotion d''hiver 2024 d''Antler à Berlin. Il a été joueur d''esport, classé une fois parmi les cent meilleurs de League of Legends.

Peec AI lance sa plateforme en février 2025. Elle mesure comment les marques apparaissent dans les réponses de ChatGPT, Perplexity ou Gemini, des moteurs de recherche fondés sur l''IA.

En novembre 2025, l''entreprise lève 21 millions de dollars en série A. En mai 2026, TechCrunch, citant des données internes vérifiées, lui attribue plus de 10 millions de dollars de revenu annualisé.', 'Marius Meiners met his co-founders, Daniel Drabo and Tobias Siwonia, in Antler''s Winter 2024 cohort in Berlin. He was an esports player, once ranked among the top 100 League of Legends players.

Peec AI launched its platform in February 2025. It measures how brands appear in answers from ChatGPT, Perplexity or Gemini, AI-based search engines.

In November 2025, the company raised $21 million in a Series A. In May 2026, TechCrunch, citing internal data it verified, credited it with more than $10 million in annualized revenue.',
  NULL, NULL,
  '/portraits/marius-meiners.webp', 'Photo : Peec AI', '[{"label":"Peec AI","url":"https://peec.ai"},{"label":"Annonce de la série A par Marius Meiners","url":"https://peec.ai/blog/we-raised-21m-series-a-to-help-brands-win-in-ai-search"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'malte-kosub', 63, 'Malte Kosub', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'Parloa', 'DE', 'industrialisation',
  'Malte Kosub dirige Parloa, une start-up berlinoise dont les agents d''IA répondent aux clients de groupes comme Allianz ou Swiss Life.', 'Malte Kosub runs Parloa, a Berlin start-up whose AI agents answer the customers of groups such as Allianz and Swiss Life.', 'Malte Kosub cofonde Parloa avec Stefan Ostwald, directeur technique. La start-up berlinoise construit des agents d''IA qui répondent aux clients de grandes entreprises, d''abord par la voix.

En avril 2024, Parloa lève 66 millions de dollars en série B. En mai 2025, elle en lève 120, pour un milliard de valorisation, puis 350 en janvier 2026, pour une valorisation de trois milliards de dollars. Elle compte alors environ 380 personnes à New York, Berlin et Munich.

En juillet 2026, sa plateforme devient « SAP Endorsed App », c''est-à-dire certifiée par SAP.', 'Malte Kosub co-founded Parloa with Stefan Ostwald, its CTO. The Berlin start-up builds AI agents that answer the customers of large companies, voice first.

In April 2024, Parloa raised $66 million in a Series B. In May 2025 it raised $120 million at a $1 billion valuation, then $350 million in January 2026 at a valuation of $3 billion. It then had about 380 people in New York, Berlin and Munich.

In July 2026, its platform became an "SAP Endorsed App", meaning certified by SAP.',
  NULL, NULL,
  '/portraits/malte-kosub.webp', 'Photo : Parloa', '[{"label":"Parloa","url":"https://www.parloa.com/"},{"label":"Parloa : à propos","url":"https://www.parloa.com/about-us/"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'nikola-mrksic', 64, 'Nikola Mrkšić', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'PolyAI', 'GB', 'industrialisation',
  'Cofondateur de PolyAI, il conçoit des agents vocaux qui répondent au téléphone des services clients de grandes entreprises, issus de la recherche de Cambridge.', 'Co-founder of PolyAI, he builds voice agents that answer customer-service phone calls for large companies, born from Cambridge research.', 'Nikola Mrkšić naît à Belgrade et part étudier à l''université de Cambridge avec une bourse complète. Il y prépare un doctorat sous la direction de Steve Young et rejoint, en parallèle, la jeune entreprise VocalIQ, rachetée ensuite par Apple.

En 2017, il cofonde PolyAI à Londres avec Tsung-Hsien Wen et Pei-Hao Su. Ses agents vocaux répondent aux appels de clients comme Marriott ou PG&E.

En décembre 2025, PolyAI lève 86 millions de dollars, portant le total à plus de 200 millions.', 'Nikola Mrkšić was born in Belgrade and went to the University of Cambridge on a full scholarship. There he did a PhD under Steve Young and, alongside it, joined the young company VocalIQ, later acquired by Apple.

In 2017, he co-founded PolyAI in London with Tsung-Hsien Wen and Pei-Hao Su. Its voice agents answer calls for customers such as Marriott and PG&E.

In December 2025, PolyAI raised 86 million dollars, bringing its total funding to over 200 million.',
  NULL, NULL,
  '/portraits/nikola-mrksic.webp', 'Photo : PolyAI', '[{"label":"PolyAI","url":"https://poly.ai/about"},{"label":"PolyAI lève 86 M$ (décembre 2025)","url":"https://poly.ai/blog/polyai-raises-86m-to-transform-how-enterprises-talk-to-their-customers"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'jan-philipp-haas', 65, 'Jan-Philipp Haas', 'Cofondateur et directeur général', 'Co-founder and CEO',
  'Conduct', 'GB', 'industrialisation',
  'Ancien de Palantir, il dirige à Londres Conduct, une IA qui aide les grandes entreprises à comprendre et à transformer leurs logiciels, notamment SAP.', 'A Palantir alumnus, he runs Conduct in London, an AI that helps large companies understand and transform their software, notably SAP.', 'Jan-Philipp Haas a dirigé chez Palantir les avant-ventes et l''après-vente pour l''Allemagne, la Suisse et l''Autriche. En 2024, il fonde Conduct avec deux anciens collègues de Palantir.\n\nConduct propose une IA qui lit le code personnalisé des logiciels d''entreprise, notamment SAP, pour en révéler les dépendances et accompagner leur transformation.\n\nLe 17 juin 2026, l''entreprise annonce une série A de 60 millions de dollars, menée par Index Ventures et ICONIQ, avec SAP comme investisseur stratégique. Elle compte alors environ 35 personnes à Londres.', 'Jan-Philipp Haas led pre- and post-sales at Palantir for Germany, Switzerland and Austria. In 2024, he founded Conduct with two former Palantir colleagues.\n\nConduct offers an AI that reads the custom code of enterprise software, notably SAP, to reveal its dependencies and support its transformation.\n\nOn 17 June 2026, the company announced a $60 million Series A, co-led by Index Ventures and ICONIQ, with SAP as a strategic investor. It then had about 35 people in London.',
  NULL, NULL,
  NULL, NULL, '[{"label":"Conduct, site officiel","url":"https://www.conduct.ai"},{"label":"Conduct, annonce de la série A","url":"https://www.conduct.ai/blog/series-a"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'fabian-theis', 75, 'Fabian Theis', 'Directeur du Computational Health Center', 'Director of the Computational Health Center',
  'Helmholtz Munich', 'DE', 'industrialisation',
  'Il dirige le Computational Health Center de Helmholtz Munich, où l''IA sert à lire le fonctionnement des cellules une à une.', 'He heads the Computational Health Center at Helmholtz Munich, where AI is used to read how cells work, one at a time.', 'Fabian Theis étudie les mathématiques et la physique à Ratisbonne, puis obtient deux doctorats : physique (2002) et informatique (2003). Professeur à la TU Munich depuis 2013, il dirige l''Institut de biologie computationnelle de Helmholtz Munich.

Depuis 2022, il dirige le Computational Health Center. Son équipe conçoit des modèles d''apprentissage automatique pour lire l''activité des gènes cellule par cellule, et publie des outils libres comme Scanpy.

Il reçoit le prix Leibniz en 2023 et est élu à l''Académie Leopoldina en 2025.', 'Fabian Theis studied mathematics and physics in Regensburg, then earned two doctorates: physics (2002) and computer science (2003). A professor at TU Munich since 2013, he directs the Institute of Computational Biology at Helmholtz Munich.

Since 2022, he has headed the Computational Health Center. His team builds machine-learning models that read gene activity cell by cell, and releases open-source tools such as Scanpy.

He received the Leibniz Prize in 2023 and was elected to the Leopoldina Academy in 2025.',
  NULL, NULL,
  '/portraits/fabian-theis.webp', 'Photo : Helmholtz Munich / Matthias Tunger Photodesign', '[{"label":"Profil, Helmholtz Munich","url":"https://www.helmholtz-munich.de/en/icb/fabian-theis"},{"label":"Theis Lab","url":"https://www.helmholtz-munich.de/en/icb/research-groups/theis-lab"},{"label":"Profil, TU Munich","url":"https://www.professoren.tum.de/en/theis-fabian"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'nicolas-dufourcq', 86, 'Nicolas Dufourcq', 'Directeur général', 'Chief Executive Officer',
  'Bpifrance', 'FR', 'industrialisation',
  'Il dirige Bpifrance, la banque publique d''investissement, qui a annoncé 10 milliards d''euros d''ici 2029 pour soutenir l''écosystème français de l''IA.', 'He leads Bpifrance, France''s public investment bank, which announced 10 billion euros through 2029 to support the French AI ecosystem.', 'Diplômé de HEC et de l''ENA, il passe par l''Inspection des finances, puis par France Télécom, où il dirige Wanadoo de 2000 à 2002, et par Capgemini.

Il dirige Bpifrance depuis sa création en janvier 2013. Il préside aussi le conseil de surveillance de STMicroelectronics, fabricant européen de puces.

En 2025, Bpifrance annonce 10 milliards d''euros d''ici 2029 pour l''IA. En mai 2025, elle cofonde avec MGX, Mistral AI et NVIDIA un campus IA de 1,4 GW en Île-de-France.', 'A graduate of HEC and ENA, he worked at the Inspection générale des finances, then at France Télécom, where he ran Wanadoo from 2000 to 2002, and at Capgemini.

He has led Bpifrance since its creation in January 2013. He also chairs the supervisory board of STMicroelectronics, a European chipmaker.

In 2025, Bpifrance announced 10 billion euros through 2029 for AI. In May 2025, it co-founded with MGX, Mistral AI and NVIDIA a 1.4 GW AI campus in the Paris region.',
  NULL, NULL,
  '/portraits/nicolas-dufourcq.webp', 'Photo : Bogdan Hoyaux / Union européenne, CC BY 4.0, via Wikimedia Commons', '[{"label":"Bpifrance","url":"https://www.bpifrance.fr"},{"label":"Article Wikipédia","url":"https://fr.wikipedia.org/wiki/Nicolas_Dufourcq"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'jeannette-zu-furstenberg', 87, 'Jeannette zu Fürstenberg', 'Présidente et Managing Director, responsable de l''Europe', 'President and Managing Director, Head of Europe',
  'General Catalyst', 'DE', 'industrialisation',
  'Elle dirige l''Europe du fonds américain General Catalyst, siège aux conseils de Mistral AI et Helsing, et porte l''initiative EU AI Champions pour financer l''IA européenne.', 'She leads Europe for the US fund General Catalyst, sits on the boards of Mistral AI and Helsing, and helps drive the EU AI Champions initiative to back European AI.', 'Née en 1982 à Duisbourg, Jeannette zu Fürstenberg étudie la communication et l''économie à Munich, puis à l''ESCP à Paris, et passe un doctorat à la Freie Universität de Berlin. Elle travaille chez Ernst & Young et AXA avant de rejoindre l''écosystème des start-ups en 2013.

En 2016, elle cofonde le fonds La Famiglia avec Robert Lacher, pensé comme un pont entre start-ups et PME industrielles. En 2023, La Famiglia fusionne avec General Catalyst, dont elle dirige les activités européennes.

Elle siège aux conseils de Mistral AI, Helsing et Legora, et d''Iceye depuis décembre 2025. Elle est l''une des dirigeantes de l''initiative EU AI Champions.', 'Born in 1982 in Duisburg, Jeannette zu Fürstenberg studied communications and economics in Munich, then at ESCP in Paris, and earned a doctorate at the Freie Universität Berlin. She worked at Ernst & Young and AXA before joining the startup world in 2013.

In 2016, she co-founded the fund La Famiglia with Robert Lacher, designed as a bridge between startups and industrial SMEs. In 2023, La Famiglia merged with General Catalyst, where she leads European operations.

She sits on the boards of Mistral AI, Helsing and Legora, and of Iceye since December 2025. She is one of the leaders of the EU AI Champions initiative.',
  NULL, NULL,
  '/portraits/jeannette-zu-furstenberg.webp', 'Photo : General Catalyst', '[{"label":"Page General Catalyst","url":"https://www.generalcatalyst.com/team/jeannette-zu-furstenberg"},{"label":"EU AI Champions Initiative","url":"https://aichampions.eu/"},{"label":"Wikipédia","url":"https://en.wikipedia.org/wiki/Jeannette_zu_F%C3%BCrstenberg"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'bertrand-rondepierre', 88, 'Bertrand Rondepierre', 'Directeur de l''agence', 'Director of the agency',
  'Agence ministérielle pour l''intelligence artificielle de défense (AMIAD)', 'FR', 'industrialisation',
  'Il dirige depuis 2024 l''agence qui pilote l''IA de défense en France, après la Direction générale de l''armement puis Google.', 'Since 2024 he has led the agency that steers defence AI in France, after the French defence procurement agency (DGA) and then Google.', 'Polytechnicien, diplômé de Télécom Paris et du master MVA de l''ENS Paris-Saclay, Bertrand Rondepierre débute à la Direction générale de l''armement. Il contribue, aux côtés de Cédric Villani, à la stratégie nationale pour l''IA présentée en 2018.\n\nIl occupe ensuite des fonctions de direction chez Google Research puis Google Brain, et participe à la fusion avec DeepMind. Depuis 2024, il dirige l''AMIAD, l''agence de l''IA de défense du ministère des Armées.\n\nEn septembre 2025, le ministère inaugure ASGARD, supercalculateur classifié de 1 024 puces installé au Mont-Valérien et exploité par l''AMIAD.', 'A graduate of École polytechnique, Télécom Paris and the MVA master''s at ENS Paris-Saclay, Bertrand Rondepierre starts at the French defence procurement agency (DGA). Alongside Cédric Villani, he contributes to the national AI strategy presented in 2018.\n\nHe then holds leadership roles at Google Research and then Google Brain, and takes part in the merger with DeepMind. Since 2024, he has led AMIAD, the defence AI agency of the Ministry of the Armed Forces.\n\nIn September 2025, the ministry inaugurates ASGARD, a classified supercomputer with 1,024 chips, installed at Mont-Valérien and operated by AMIAD.',
  'L''IA militaire, ce n''est pas une IA hors-sol. C''est une IA capable de fonctionner dans la poussière, la boue, sous les chocs…', 'Military AI is not detached from reality. It is AI able to work in dust, mud, under shocks…',
  '/portraits/bertrand-rondepierre.webp', 'Photo : ministère des Armées', '[{"label":"AMIAD, page officielle (ministère des Armées)","url":"https://www.defense.gouv.fr/amiad-agence-ia-defense"},{"label":"Focus sur Bertrand Rondepierre","url":"https://www.defense.gouv.fr/amiad-agence-cle-lia-defense"},{"label":"AMIAD sur Wikipédia","url":"https://fr.wikipedia.org/wiki/Agence_minist%C3%A9rielle_pour_l%27intelligence_artificielle_de_D%C3%A9fense"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'niklas-zennstrom', 89, 'Niklas Zennström', 'Fondateur et PDG', 'Founder and CEO',
  'Atomico', 'GB', 'industrialisation',
  'Cofondateur de Skype, il dirige Atomico, un fonds de capital-risque londonien qui finance des start-up technologiques européennes, dont DeepL.', 'Skype co-founder, he leads Atomico, a London venture capital firm that backs European technology start-ups, including DeepL.', 'Niklas Zennström étudie l''ingénierie physique et la gestion à l''université d''Uppsala, en Suède. Il débute chez l''opérateur Tele2 en 1991, puis cofonde Skype avec Janus Friis en 2003. eBay rachète Skype en 2005, Microsoft en 2011.

Il crée ensuite Atomico, un fonds de capital-risque (il finance des start-up contre des parts) basé à Londres, dont il est le PDG. Le fonds a soutenu Supercell, Klarna et DeepL.

En septembre 2024, Atomico annonce la levée d''un nouveau fonds pour investir dans la tech européenne. Skype a fermé le 5 mai 2025.', 'Niklas Zennström studies engineering physics and business administration at Uppsala University in Sweden. He starts at telecom operator Tele2 in 1991, then co-founds Skype with Janus Friis in 2003. eBay buys Skype in 2005, Microsoft in 2011.

He then creates Atomico, a venture capital firm (it funds start-ups in exchange for shares) based in London, where he is CEO. The firm has backed Supercell, Klarna and DeepL.

In September 2024, Atomico announces a new fund to invest in European tech. Skype shut down on 5 May 2025.',
  NULL, NULL,
  '/portraits/niklas-zennstrom.webp', 'Photo : TechCrunch, CC BY 2.0, via Wikimedia Commons', '[{"label":"Atomico","url":"https://www.atomico.com/"},{"label":"Wikipédia (EN)","url":"https://en.wikipedia.org/wiki/Niklas_Zennstr%C3%B6m"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'klaus-hommels', 90, 'Klaus Hommels', 'Fondateur et président', 'Founder and Chairman',
  'Lakestar', 'CH', 'industrialisation',
  'Fondateur de Lakestar, fonds de capital-risque européen basé à Zurich, il a investi dans Spotify et soutient aujourd''hui des start-up de l''IA et de la défense comme Helsing.', 'Founder of Lakestar, a Zurich-based European venture capital firm, he invested in Spotify and now backs AI and defence start-ups such as Helsing.', 'Klaus Hommels naît en 1967. Docteur en finance de l''université de Fribourg, il passe par Bertelsmann, AOL Allemagne (1995-1999) et Apax Partners. Investisseur privé, il soutient Skype, Facebook, puis Spotify, dont il rejoint le conseil en 2009.

Il fonde Lakestar à Zurich en 2012. En avril 2024, le fonds annonce 600 millions de dollars levés. Sa branche défense, Lakestar Resilience, compte Helsing et Isar Aerospace. En octobre 2025, selon Forbes, il annonce investir désormais son propre capital.', 'Klaus Hommels was born in 1967. He holds a PhD in finance from the University of Fribourg and worked at Bertelsmann, AOL Germany (1995-1999) and Apax Partners. As a private investor he backed Skype, Facebook, then Spotify, whose board he joined in 2009.

He founded Lakestar in Zurich in 2012. In April 2024, the firm announced $600 million raised. Its defence arm, Lakestar Resilience, counts Helsing and Isar Aerospace. In October 2025, according to Forbes, he said he would now invest his own capital.',
  NULL, NULL,
  '/portraits/klaus-hommels.webp', 'Photo : Milken Institute', '[{"label":"Lakestar","url":"https://www.lakestar.com/"},{"label":"Wikipédia (allemand)","url":"https://de.wikipedia.org/wiki/Klaus_Hommels"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'charles-gorintin', 91, 'Charles Gorintin', 'Cofondateur et directeur technique', 'Co-founder and CTO',
  'Alan', 'FR', 'industrialisation',
  'Cofondateur et directeur technique d''Alan, assureur santé, il est aussi cofondateur non exécutif de Mistral AI depuis 2023.', 'Co-founder and CTO of Alan, a health insurer, he has also been a non-executive co-founder of Mistral AI since 2023.', 'Formé à l''École des Ponts ParisTech et à la Haas School of Business de l''université de Berkeley, Charles Gorintin a occupé des postes de direction en data science chez Facebook, Instagram et Twitter.

En 2016, il cofonde l''assureur santé Alan avec Jean-Charles Samuelian-Werve et en devient le directeur technique. Depuis 2023, il est aussi cofondateur non exécutif de Mistral AI.

En juin 2026, Alan lève 480 millions d''euros pour une valorisation de 5,5 milliards, afin de se développer dans de nouveaux pays et d''investir dans l''IA.', 'Trained at École des Ponts ParisTech and the Haas School of Business at the University of California, Berkeley, Charles Gorintin held data science leadership positions at Facebook, Instagram and Twitter.

In 2016, he co-founded the health insurer Alan with Jean-Charles Samuelian-Werve and became its CTO. Since 2023, he has also been a non-executive co-founder of Mistral AI.

In June 2026, Alan raised 480 million euros at a 5.5 billion euro valuation, to expand into new countries and invest in AI.',
  NULL, NULL,
  '/portraits/charles-gorintin.webp', 'Photo : French-American Foundation', '[{"label":"Alan","url":"https://alan.com/en/careers"},{"label":"Project Syndicate : Charles Gorintin","url":"https://www.project-syndicate.org/columnist/charles-gorintin"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'philippe-tibi', 92, 'Philippe Tibi', 'Professeur de stratégie et finance', 'Professor of strategy and finance',
  'École polytechnique', 'FR', 'industrialisation',
  'Professeur à l''École polytechnique, auteur en 2019 du rapport à l''origine de l''initiative Tibi, qui oriente l''épargne des assureurs français vers les entreprises technologiques.', 'A professor at École polytechnique, he wrote the 2019 report behind the Tibi Initiative, which directs French insurers'' savings towards technology companies.', 'Polytechnicien (promotion 1977) et diplômé de Télécom Paris, il dirige les marchés actions et la banque d''investissement d''UBS en France jusqu''en 2012. Il préside l''Amafi, association des banques de marché, de 2007 à 2014 et fonde Pergamon Campus en 2013.

En juillet 2019, il remet au gouvernement un rapport sur le financement des entreprises technologiques. L''initiative Tibi en découle : assureurs et autres investisseurs de long terme financent des fonds qui soutiennent ces entreprises.

En juin 2026, la troisième phase est annoncée : 13 milliards d''euros auprès d''une quarantaine d''investisseurs institutionnels.', 'A graduate of École polytechnique (class of 1977) and Télécom Paris, he ran UBS''s equity markets and investment banking in France until 2012. He chaired Amafi, the association of market banks, from 2007 to 2014 and founded Pergamon Campus in 2013.

In July 2019, he handed the government a report on financing technology companies. The Tibi Initiative followed: insurers and other long-term investors fund vehicles that back these companies.

In June 2026, the third phase was announced: 13 billion euros from about forty institutional investors.',
  NULL, NULL,
  '/portraits/philippe-tibi.webp', 'Photo : École polytechnique', '[{"label":"Initiative Tibi III et extension européenne (École polytechnique)","url":"https://www.polytechnique.edu/en/news/tibi-initiative-launch-phase-3-and-expansion-european-level"},{"label":"Initiative Tibi, rapport d''activité (Direction générale du Trésor)","url":"https://www.tresor.economie.gouv.fr/Articles/2025/09/16/tiibi-initiative-a-target-raised-to-15-billion"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'joelle-barral', 94, 'Joëlle Barral', 'Directrice de la recherche en IA', 'Director of AI Research',
  'Google DeepMind', 'FR', 'industrialisation',
  'Ingénieure polytechnicienne, elle dirige à Paris la recherche de Google DeepMind sur les modèles de pointe et l''IA pour les sciences du vivant. Elle siège au panel scientifique de l''ONU sur l''IA.', 'A Polytechnique-trained engineer, she leads Google DeepMind''s research in Paris on frontier models and AI for the life sciences. She sits on the UN scientific panel on AI.', 'Polytechnicienne, Joëlle Barral obtient un master et un doctorat en génie électrique à Stanford, en imagerie médicale (IRM). Chez Verily, filiale de Google, elle dirige le logiciel et participe à Verb Surgical, coentreprise de robotique chirurgicale avec Ethicon (Johnson & Johnson).

Chez Google DeepMind, à Paris, elle dirige la recherche fondamentale sur les modèles de pointe et l''IA appliquée aux sciences du vivant.

Élue à l''Académie des technologies le 10 décembre 2025, elle est nommée le 12 février 2026 parmi les 40 experts du panel scientifique de l''ONU sur l''IA.', 'Polytechnique graduate Joëlle Barral earned a master''s and a PhD in electrical engineering at Stanford, in medical imaging (MRI). At Verily, Google''s subsidiary, she led software and worked on Verb Surgical, a surgical robotics joint venture with Ethicon (Johnson & Johnson).

At Google DeepMind in Paris, she leads foundational research on frontier models and AI applied to the life sciences.

Elected to the Académie des technologies on 10 December 2025, she was named on 12 February 2026 among the 40 experts of the UN scientific panel on AI.',
  'Bien sûr, l''IA est un outil, et ne pourra jamais remplacer l''humain.', 'Of course, AI is a tool, and it will never be able to replace humans.',
  '/portraits/joelle-barral.webp', 'Photo : Académie des technologies', '[{"label":"Académie des technologies","url":"https://www.academie-technologies.fr/academiciens/barral-joelle/"},{"label":"Google, entretien avec Joëlle Barral","url":"https://blog.google/intl/fr-fr/nouvelles-de-lentreprise/azerty/barral-ia/"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'roxanne-varza', 96, 'Roxanne Varza', 'Directrice', 'Director',
  'Station F', 'FR', 'industrialisation',
  'Elle dirige Station F depuis 2015, campus parisien qui accueille plus de 1 000 startups et lance en 2026 un programme dédié aux startups d''IA.', 'She has run Station F since 2015, a Paris campus hosting more than 1,000 startups, and launched a program for AI startups in 2026.', 'Née en Californie, Roxanne Varza étudie à UCLA, à Sciences Po Paris et à la London School of Economics. Elle est rédactrice de TechCrunch France en 2010-2011, puis développe les programmes de Microsoft Ventures à Paris de 2012 à 2015.

Elle dirige Station F depuis octobre 2015. Le campus, ouvert en 2017 dans la halle Freyssinet à Paris, accueille plus de 1 000 startups.

En janvier 2026, Station F lance F/ai, un programme pour startups d''IA. Sa première promotion a levé 34 millions de dollars en pré-amorçage ; la deuxième débute en septembre 2026.', 'Born in California, Roxanne Varza studied at UCLA, Sciences Po Paris and the London School of Economics. She was French editor of TechCrunch in 2010-2011, then built Microsoft Ventures programs in Paris from 2012 to 2015.

She has directed Station F since October 2015. The campus, opened in 2017 in the Freyssinet hall in Paris, hosts more than 1,000 startups.

In January 2026, Station F launched F/ai, a program for AI startups. Its first cohort raised $34 million in pre-seed funding; the second starts in September 2026.',
  NULL, NULL,
  '/portraits/roxanne-varza.webp', 'Photo : jeanbaptisteparis, CC BY-SA 2.0, via Wikimedia Commons', '[{"label":"Station F","url":"https://stationf.co/"},{"label":"Wikipédia : Roxanne Varza","url":"https://fr.wikipedia.org/wiki/Roxanne_Varza"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'xavier-lazarus', 97, 'Xavier Lazarus', 'Cofondateur et associé directeur', 'Co-founder and Managing Partner',
  'Elaia', 'FR', 'industrialisation',
  'Cofondateur d’Elaia, fonds européen de capital-risque, ce mathématicien de formation dirige un fonds qui compte les start-up d’IA Aqemia et H parmi ses participations.', 'Co-founder of Elaia, a European venture capital firm, this mathematician by training leads a fund whose portfolio includes the AI start-ups Aqemia and H.', 'Normalien, agrégé et docteur en mathématiques, Xavier Lazarus débute dans la recherche en théorie des groupes et géométrie arithmétique. Il fonde ensuite une start-up d’apprentissage en ligne, rachetée en 1999, puis crée l’activité de capital-risque de CPR, racheté par Crédit Agricole Indosuez.

Il cofonde Elaia, qui investit de la préamorçage à la préintroduction en Bourse, et Lazard Elaia Capital. Aqemia et H figurent au portefeuille d’Elaia.

En juillet 2026, Lazard prend 51 % du capital d’Elaia, qui garde son indépendance de gestion.', 'A graduate of the École Normale Supérieure, with the agrégation and a PhD in mathematics, Xavier Lazarus starts in research on group theory and arithmetic geometry. He then founds an e-learning start-up, acquired in 1999, and builds the venture capital arm of CPR, later bought by Crédit Agricole Indosuez.

He co-founds Elaia, which invests from pre-seed to pre-IPO, and Lazard Elaia Capital. Aqemia and H are in Elaia’s portfolio.

In July 2026, Lazard takes a 51% stake in Elaia, which keeps its independence in management.',
  NULL, NULL,
  '/portraits/xavier-lazarus.webp', 'Photo : Elaia', '[{"label":"Profil sur Elaia","url":"https://www.elaia.com/team/xavier-lazarus"},{"label":"Elaia","url":"https://www.elaia.com/"},{"label":"Lazard Elaia Capital","url":"https://www.lazardelaiacapital.com/"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'benedikt-von-schoeler', 98, 'Benedikt von Schoeler', 'Associé général et cofondateur', 'General Partner and co-founder',
  'Vsquared Ventures', 'DE', 'industrialisation',
  'Cofondateur du fonds Vsquared, il finance depuis Munich des start-up européennes de technologies de pointe : puces, quantique, robotique, spatial.', 'Co-founder of the Vsquared fund, he backs European frontier-technology start-ups from Munich: chips, quantum, robotics, space.', 'Benedikt von Schoeler compte plus de quinze ans dans la finance. Diplômé de l''université de Saint-Gall et de l''INSEAD (MBA), il travaille en fusions-acquisitions chez GCA Altium, puis chez HgCapital. Il dirige ensuite Vito Ventures, fonds qui précède Vsquared, dont il est l''un des associés fondateurs.

Basé à Munich, Vsquared finance des start-up de technologies avancées : fusées (Isar Aerospace), ordinateurs quantiques (IQM), puces en graphène (Black Semiconductor), robots (Neura Robotics).

En juin 2026, le fonds ouvre à Londres son premier bureau hors de Munich. Son plus gros fonds, de 214 millions d''euros, a été lancé fin 2022.', 'Benedikt von Schoeler has more than fifteen years in finance. A graduate of the University of St. Gallen and INSEAD (MBA), he worked in mergers and acquisitions at GCA Altium, then at HgCapital. He then led Vito Ventures, the fund that preceded Vsquared, of which he is one of the founding partners.

Based in Munich, Vsquared backs frontier-technology start-ups: rockets (Isar Aerospace), quantum computers (IQM), graphene chips (Black Semiconductor), robots (Neura Robotics).

In June 2026, the fund opens its first office outside Munich, in London. Its largest fund, at 214 million euros, was launched in late 2022.',
  NULL, NULL,
  '/portraits/benedikt-von-schoeler.webp', 'Photo : Vsquared Ventures', '[{"label":"Profil chez Vsquared","url":"https://vsquared.vc/team_member/benedikt-von-schoeler/"},{"label":"Vsquared Ventures","url":"https://vsquared.vc/"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'marc-menase', 99, 'Marc Menasé', 'Associé fondateur et directeur des investissements', 'Founding Partner and Chief Investments Officer',
  'Founders Future', 'FR', 'industrialisation',
  'Fondateur de Founders Future et cofondateur de France Digitale, il finance depuis Paris des start-up d''IA, dont Harmattan AI, Raidium et Perplexity.', 'Founder of Founders Future and co-founder of France Digitale, he backs AI start-ups from Paris, including Harmattan AI, Raidium and Perplexity.', 'Diplômé d''HEC, Marc Menasé débute chez Kelkoo, comparateur de prix racheté par Yahoo. Il cofonde ensuite Nextedia, agence de marketing numérique cédée à Lagardère en 2007. Business angel depuis 2005, il a financé plus de cent start-up.

En 2012, il cofonde France Digitale avec Marie Ekeland, association qui réunit start-up et investisseurs. En 2018, il lance Founders Future, basé à Paris et San Francisco, qui investit de l''amorçage (pre-seed) à la croissance.

En 2026, le fonds FF Growth US de Founders Future, dédié aux leaders de l''IA dès la série B, est ouvert à la souscription.', 'A graduate of HEC, Marc Menasé starts at Kelkoo, a price-comparison site later sold to Yahoo. He then co-founds Nextedia, a digital marketing agency sold to Lagardère in 2007. A business angel since 2005, he has backed more than a hundred start-ups.

In 2012, he co-founds France Digitale with Marie Ekeland, an association bringing together start-ups and investors. In 2018, he launches Founders Future, based in Paris and San Francisco, which invests from pre-seed to growth stage.

In 2026, Founders Future''s FF Growth US fund, aimed at AI leaders from Series B onward, is open for subscription.',
  NULL, NULL,
  '/portraits/marc-menase.webp', 'Photo : Founders Future', '[{"label":"Founders Future","url":"https://www.foundersfuture.com/"},{"label":"Profil sur Founders Future","url":"https://www.foundersfuture.com/teams/marc-menase"},{"label":"France Digitale (Wikipédia)","url":"https://fr.wikipedia.org/wiki/France_Digitale"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'philippe-botteri', 100, 'Philippe Botteri', 'Associé', 'Partner',
  'Accel', 'GB', 'industrialisation',
  'Associé chez Accel à Londres, il investit dans l''IA, le cloud et la cybersécurité en Europe : Doctolib, UiPath, Synthesia. Il cosigne le rapport Euroscape.', 'A partner at Accel in London, he invests in AI, cloud and security in Europe, including Doctolib, UiPath and Synthesia. He co-authors the Euroscape report.', 'Polytechnicien, diplômé de l''École des Mines, Philippe Botteri commence chez McKinsey, puis rejoint Bessemer Venture Partners, dans la Silicon Valley, où il investit dans le cloud. Il entre chez Accel en 2011.

Depuis Londres, il suit l''IA, les logiciels d''entreprise et la cybersécurité. Son portefeuille compte BlaBlaCar, Doctolib, UiPath, Snyk et Synthesia.

En octobre 2024, il cosigne Euroscape : sur 2023-2024, environ 80 % des quelque 56 milliards de dollars investis en IA sont allés à des entreprises américaines.', 'A graduate of École Polytechnique and École des Mines, Philippe Botteri starts at McKinsey, then joins Bessemer Venture Partners in Silicon Valley, where he invests in cloud software. He joins Accel in 2011.

From London, he follows AI, enterprise software and cybersecurity. His portfolio includes BlaBlaCar, Doctolib, UiPath, Snyk and Synthesia.

In October 2024, he co-authors Euroscape: in 2023-2024, about 80% of the roughly $56 billion invested in AI went to US companies.',
  NULL, NULL,
  '/portraits/philippe-botteri.webp', 'Photo : Accel', '[{"label":"Profil Accel","url":"https://www.accel.com/people/philippe-botteri"},{"label":"Euroscape 2024 : AI eating software","url":"https://www.accel.com/noteworthies/euroscape-2024-ai-eating-software"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'sandra-wachter', 66, 'Sandra Wachter', 'Professeure de technologie et de régulation', 'Professor of Technology and Regulation',
  'Oxford Internet Institute, University of Oxford', 'GB', 'culture',
  'Juriste à Oxford, elle étudie ce que le droit peut exiger de l''IA : explications, transparence, lutte contre les biais algorithmiques.', 'A lawyer at Oxford, she studies what the law can demand of AI: explanations, transparency and action against algorithmic bias.', 'Autrichienne, Sandra Wachter étudie le droit à l''université de Vienne, où elle obtient un doctorat en 2015, et suit un master de sciences sociales à Oxford. Elle travaille au ministère autrichien de la Santé, puis devient chercheuse à l''Alan Turing Institute en 2016.

Professeure à l''Oxford Internet Institute depuis août 2022, elle dirige le programme GET, consacré à la gouvernance des technologies émergentes. Elle travaille sur l''IA explicable, les biais algorithmiques et l''impact de l''IA générative.

En 2025, elle reçoit un prix de recherche de la fondation Alexander von Humboldt, doté de 3,5 millions d''euros.', 'Austrian by origin, Sandra Wachter studied law at the University of Vienna, where she earned a PhD in 2015, and took a master''s degree in social sciences at Oxford. She worked at the Austrian Ministry of Health, then became a researcher at the Alan Turing Institute in 2016.

A professor at the Oxford Internet Institute since August 2022, she leads the GET programme on the governance of emerging technologies. She works on explainable AI, algorithmic bias and the impact of generative AI.

In 2025, she received a research award from the Alexander von Humboldt Foundation, worth 3.5 million euros.',
  NULL, NULL,
  '/portraits/sandra-wachter.webp', 'Photo : The Berkman Klein Center for Internet & Society, CC BY 3.0, via Wikimedia Commons', '[{"label":"Profil Oxford Internet Institute","url":"https://www.oii.ox.ac.uk/people/profiles/sandra-wachter/"},{"label":"Wikipédia (anglais)","url":"https://en.wikipedia.org/wiki/Sandra_Wachter"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'yann-lecun', 67, 'Yann LeCun', 'Cofondateur et Chairman', 'Co-founder and Chairman',
  'AMI Labs (Advanced Machine Intelligence)', 'FR', 'culture',
  'Pionnier de l''apprentissage profond et prix Turing 2018, il cofonde à Paris AMI Labs pour bâtir des IA qui comprennent le monde réel.', 'A deep learning pioneer and 2018 Turing Award winner, he co-founded AMI Labs in Paris to build AI that understands the real world.', 'Né en France en 1960, Yann LeCun est ingénieur diplômé de l''ESIEE Paris (1983) et docteur de l''université Pierre-et-Marie-Curie (1987). Professeur à New York University, il devient en décembre 2013 le premier directeur du laboratoire de recherche en IA de Meta. Il reçoit le prix Turing en 2018 avec Yoshua Bengio et Geoffrey Hinton.

En novembre 2025, il annonce quitter Meta pour fonder AMI Labs, consacré aux « modèles du monde » : des IA qui comprennent la réalité physique.

En mars 2026, la société, basée à Paris, lève 1,03 milliard de dollars, sur une valorisation de 3,5 milliards avant investissement.', 'Born in France in 1960, Yann LeCun holds an engineering degree from ESIEE Paris (1983) and a PhD from Pierre-and-Marie-Curie University (1987). A professor at New York University, he became in December 2013 the first director of Meta''s AI research laboratory. He received the Turing Award in 2018 with Yoshua Bengio and Geoffrey Hinton.

In November 2025, he announced he was leaving Meta to found AMI Labs, focused on "world models": AI that understands physical reality.

In March 2026, the Paris-based company raised $1.03 billion at a $3.5 billion pre-money valuation.',
  NULL, NULL,
  '/portraits/yann-lecun.webp', 'Photo : Jérémy Barande / École polytechnique, CC BY-SA 2.0, via Wikimedia Commons', '[{"label":"AMI Labs","url":"https://amilabs.xyz"},{"label":"Wikipédia","url":"https://fr.wikipedia.org/wiki/Yann_Le_Cun"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'bernhard-scholkopf', 68, 'Bernhard Schölkopf', 'Directeur, département Inférence empirique', 'Director, Empirical Inference Department',
  'Max Planck Institute for Intelligent Systems', 'DE', 'culture',
  'Directeur de l''Institut Max-Planck pour les systèmes intelligents à Tübingen et cofondateur d''ELLIS, il est une référence européenne de l''apprentissage automatique et de la causalité.', 'Director of the Max Planck Institute for Intelligent Systems in Tübingen and co-founder of ELLIS, he is a leading European figure in machine learning and causality.', 'Bernhard Schölkopf étudie les mathématiques à Londres, la physique à Tübingen, puis passe un doctorat en informatique à la TU Berlin en 1997, sous la direction de Vladimir Vapnik. En 2001, il fonde à Tübingen un département de recherche en inférence empirique.

Depuis 2011, il dirige l''Institut Max-Planck pour les systèmes intelligents. Il travaille sur les méthodes à noyau et l''inférence causale : comprendre pourquoi un phénomène se produit, pas seulement qu''il se produit.

Il est cofondateur d''ELLIS, réseau européen de recherche en IA, et directeur fondateur de l''institut ELLIS de Tübingen. En 2026, il est élu à la Royal Society.', 'Bernhard Schölkopf studies mathematics in London and physics in Tübingen, then earns a PhD in computer science at TU Berlin in 1997 under Vladimir Vapnik. In 2001, he founds a research department on empirical inference in Tübingen.

Since 2011, he has directed the Max Planck Institute for Intelligent Systems. He works on kernel methods and causal inference: understanding why a phenomenon happens, not just that it happens.

He is a co-founder of ELLIS, the European AI research network, and founding director of the ELLIS Institute Tübingen. In 2026, he is elected to the Royal Society.',
  NULL, NULL,
  '/portraits/bernhard-scholkopf.webp', 'Photo : Latest Thinking, CC BY 3.0, via Wikimedia Commons', '[{"label":"Wikipedia (EN)","url":"https://en.wikipedia.org/wiki/Bernhard_Schölkopf"},{"label":"ELLIS Institute Tübingen","url":"https://institute-tue.ellis.eu/"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'max-welling', 69, 'Max Welling', 'Cofondateur et directeur technique', 'Co-founder and Chief Technology Officer',
  'CuspAI', 'NL', 'culture',
  'Physicien devenu pionnier de l''apprentissage automatique, il enseigne à l''université d''Amsterdam et cofonde CuspAI, qui conçoit des matériaux avec l''IA.', 'A physicist turned machine learning pioneer, he teaches at the University of Amsterdam and co-founded CuspAI, which designs materials with AI.', 'Max Welling obtient un doctorat de physique à Utrecht en 1998, sous la direction du prix Nobel Gerard ''t Hooft. Il devient professeur d''apprentissage automatique à l''université d''Amsterdam, puis vice-président technologie chez Qualcomm aux Pays-Bas après le rachat de sa start-up Scyfer en 2017.

Il a co-développé les autoencodeurs variationnels, une méthode qui apprend à un réseau de neurones à générer des données.

Cofondateur de CuspAI en 2024, il veut bâtir des modèles de fondation pour la chimie : concevoir des matériaux à partir des propriétés voulues. En 2025, il est élu à l''Académie royale néerlandaise des arts et des sciences.', 'Max Welling earned a physics PhD at Utrecht in 1998 under Nobel laureate Gerard ''t Hooft. He became a professor of machine learning at the University of Amsterdam, then vice president of technology at Qualcomm in the Netherlands after it acquired his start-up Scyfer in 2017.

He co-developed variational autoencoders, a method that teaches a neural network to generate data.

Co-founder of CuspAI in 2024, he aims to build foundation models for chemistry: designing materials from the properties one wants. In 2025, he was elected to the Royal Netherlands Academy of Arts and Sciences.',
  NULL, NULL,
  '/portraits/max-welling.webp', 'Photo : HumanX', '[{"label":"Page AMLab (université d''Amsterdam)","url":"https://amlab.science.uva.nl/people/MaxWelling/"},{"label":"CuspAI","url":"https://www.cusp.ai/"},{"label":"Wikipédia","url":"https://en.wikipedia.org/wiki/Max_Welling"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'gael-varoquaux', 70, 'Gaël Varoquaux', 'Cofondateur et directeur scientifique', 'Co-founder and Chief Science Officer',
  'Probabl', 'FR', 'culture',
  'Chercheur à Inria, il fait partie des créateurs de scikit-learn, bibliothèque libre de machine learning, et cofonde Probabl pour en faire vivre l''écosystème.', 'A researcher at Inria, he is one of the creators of scikit-learn, the open-source machine learning library, and co-founded Probabl to sustain its ecosystem.', 'Ancien élève de l''École normale supérieure (2001-2004), Gaël Varoquaux passe un doctorat en physique quantique à l''université Paris-Sud. Il rejoint Inria en 2008, où il devient directeur de recherche.

En 2010, il fait partie des chercheurs d''Inria qui reprennent scikit-learn, une boîte à outils libre de machine learning (apprentissage automatique) lancée en 2007. Sa première version publique sort le 1er février 2010. Il travaille aujourd''hui dans l''équipe Soda d''Inria et est directeur scientifique de Probabl.

En 2025, il reçoit un doctorat honoris causa de l''UCLouvain et devient chevalier de l''ordre national du Mérite.', 'A former student of the École normale supérieure (2001-2004), Gaël Varoquaux earned a PhD in quantum physics at Université Paris-Sud. He joined Inria in 2008 and became a research director.

In 2010, he was among the Inria researchers who took over scikit-learn, an open-source machine learning toolkit started in 2007. Its first public release came on 1 February 2010. Today he works in Inria''s Soda team and is Chief Science Officer of Probabl.

In 2025, he received an honorary doctorate from UCLouvain and was made a Knight of the National Order of Merit.',
  NULL, NULL,
  '/portraits/gael-varoquaux.webp', 'Photo : Gael Varoquaux, CC BY-SA 4.0, via Wikimedia Commons', '[{"label":"Site personnel","url":"https://gael-varoquaux.info/"},{"label":"Probabl","url":"https://probabl.ai"},{"label":"Wikipédia","url":"https://fr.wikipedia.org/wiki/Gaël_Varoquaux"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'holger-h-hoos', 71, 'Holger H. Hoos', 'Professeur d''IA, chaire Alexander von Humboldt', 'Professor of AI, Alexander von Humboldt Professorship',
  'RWTH Aachen University', 'DE', 'culture',
  'Professeur d''IA à l''Université RWTH d''Aix-la-Chapelle, il est cofondateur de CLAIRE, réseau européen de recherche en IA rebaptisé CAIRNE.', 'Professor of AI at RWTH Aachen University, he is a co-founder of CLAIRE, the European AI research network now renamed CAIRNE.', 'Holger Hoos étudie l''informatique à l''Université technique de Darmstadt, où il obtient son doctorat en 1998. Il est professeur à l''Université de la Colombie-Britannique (Canada) de 2000 à 2016, puis à l''Université de Leyde (Pays-Bas).

Depuis janvier 2022, il dirige la chaire de méthodologie de l''IA à la RWTH d''Aix-la-Chapelle, au titre d''une chaire Alexander von Humboldt.

Il cofonde CLAIRE, réseau européen de recherche en IA rebaptisé CAIRNE, qui compte aujourd''hui plus de 500 groupes et organisations membres.', 'Holger Hoos studied computer science at the Technical University of Darmstadt, where he earned his PhD in 1998. He was a professor at the University of British Columbia (Canada) from 2000 to 2016, then at Leiden University (Netherlands).

Since January 2022, he has led the Chair for AI Methodology at RWTH Aachen, under an Alexander von Humboldt Professorship.

He co-founded CLAIRE, a European AI research network renamed CAIRNE, which now counts more than 500 member groups and organisations.',
  NULL, NULL,
  '/portraits/holger-h-hoos.webp', 'Photo : Qwertzu111111, CC BY-SA 4.0, via Wikimedia Commons', '[{"label":"Chaire AIM, RWTH Aachen","url":"https://www.aim.rwth-aachen.de/"},{"label":"CAIRNE (ex-CLAIRE)","url":"https://cairne.eu/"},{"label":"Wikipédia","url":"https://en.wikipedia.org/wiki/Holger_H._Hoos"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'joanna-bryson', 72, 'Joanna Bryson', 'Professeure d''éthique et de technologie', 'Professor of Ethics and Technology',
  'Hertie School', 'DE', 'culture',
  'Professeure d''éthique et de technologie à Berlin, elle étudie comment concevoir et encadrer l''IA, et conseille des institutions internationales.', 'A professor of ethics and technology in Berlin, she studies how to design and govern AI, and advises international institutions.', 'Joanna Bryson étudie les sciences du comportement à Chicago, puis l''intelligence artificielle à Édimbourg. Elle obtient un doctorat au MIT en 2001.

De 2002 à 2019, elle enseigne l''informatique à l''université de Bath, où elle fonde un groupe de recherche en IA. En 2010, elle contribue aux Principes de la robotique britanniques. En 2017, elle cosigne dans Science une étude : les programmes apprennent les biais humains à partir de textes.

Depuis 2020, elle enseigne l''éthique et la technologie à la Hertie School, à Berlin. En février 2025, l''UCLouvain lui décerne un doctorat honoris causa.', 'Joanna Bryson studied behavioral science at Chicago, then artificial intelligence at Edinburgh. She earned a PhD at MIT in 2001.

From 2002 to 2019, she taught computer science at the University of Bath, where she founded an AI research group. In 2010, she contributed to the UK Principles of Robotics. In 2017, she co-authored a paper in Science: programs learn human biases from text.

Since 2020, she has taught ethics and technology at the Hertie School in Berlin. In February 2025, UCLouvain awarded her an honorary doctorate.',
  NULL, NULL,
  '/portraits/joanna-bryson.webp', 'Photo : World Economic Forum, CC BY 3.0, via Wikimedia Commons', '[{"label":"Page biographique de Joanna Bryson","url":"https://www.joannajbryson.org/biographies"},{"label":"Article Wikipédia (anglais)","url":"https://en.wikipedia.org/wiki/Joanna_Bryson"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'paolo-benanti', 73, 'Paolo Benanti', 'Franciscain, professeur d''éthique de l''IA', 'Franciscan friar, professor of AI ethics',
  'Université pontificale grégorienne', 'IT', 'culture',
  'Franciscain et théologien à Rome, il a conseillé le pape François sur l''IA et fait partie de l''organe consultatif de l''ONU sur l''intelligence artificielle.', 'A Franciscan friar and theologian in Rome, he advised Pope Francis on AI and has served on the UN''s advisory body on artificial intelligence.', 'Né à Rome en 1973, Paolo Benanti rejoint en 1999 le Tiers-Ordre régulier de saint François et est ordonné prêtre en 2009. Il obtient en 2012 un doctorat de théologie morale à l''Université pontificale grégorienne, avec une thèse sur le cyborg, le corps et la corporéité à l''ère post-humaine.

Il enseigne à la Grégorienne depuis 2008 et travaille sur l''éthique de la technologie et des algorithmes. Il a conseillé le pape François sur l''IA et les technologies.

Il a été membre de l''organe consultatif de haut niveau sur l''IA du secrétaire général de l''ONU, et préside en Italie, depuis sa création en 2024, la commission sur l''IA pour l''information.', 'Born in Rome in 1973, Paolo Benanti joined the Third Order Regular of Saint Francis in 1999 and was ordained a priest in 2009. In 2012 he earned a doctorate in moral theology at the Pontifical Gregorian University, with a thesis on the cyborg, the body and corporeality in the post-human era.

He has taught at the Gregorian since 2008 and works on the ethics of technology and algorithms. He advised Pope Francis on AI and technology.

He was a member of the UN Secretary-General''s High-level Advisory Body on AI, and chairs Italy''s commission on AI for information, which has existed since 2024.',
  NULL, NULL,
  '/portraits/paolo-benanti.webp', 'Photo : Paolo Pegoraro, CC BY-SA 4.0, via Wikimedia Commons', '[{"label":"Wikipédia (anglais)","url":"https://en.wikipedia.org/wiki/Paolo_Benanti"},{"label":"ONU, organe consultatif sur l''IA","url":"https://www.un.org/en/ai-advisory-body/members"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'stephane-mallat', 74, 'Stéphane Mallat', 'Professeur, chaire Sciences des données', 'Professor, Data Science chair',
  'Collège de France', 'FR', 'culture',
  'Mathématicien, pionnier des ondelettes à l''origine du standard d''image JPEG-2000. Il cherche les mathématiques qui expliquent pourquoi les réseaux de neurones fonctionnent.', 'A mathematician and pioneer of wavelets, which led to the JPEG-2000 image standard. He seeks the mathematics that explains why neural networks work.', 'Diplômé de l''École polytechnique, Stéphane Mallat obtient son doctorat à l''université de Pennsylvanie en 1988. Il enseigne au Courant Institute de New York, à Polytechnique, puis à l''ENS. Ses ondelettes, outils qui décomposent un signal à plusieurs échelles, ont mené au standard d''image JPEG-2000. En 2001, il cofonde Let it Wave, une start-up de puces qui améliorent l''image des téléviseurs haute définition.

Titulaire de la chaire Sciences des données au Collège de France depuis 2017, il cherche à expliquer par les mathématiques pourquoi les réseaux de neurones fonctionnent.

En 2025, il reçoit la médaille d''or du CNRS.', 'A graduate of École polytechnique, Stéphane Mallat earned his PhD at the University of Pennsylvania in 1988. He taught at New York''s Courant Institute, at Polytechnique, then at the ENS. His wavelets, tools that break a signal down at several scales, led to the JPEG-2000 image standard. In 2001, he co-founded Let it Wave, a start-up making chips that improve the picture of high-definition televisions.

Holder of the Data Science chair at the Collège de France since 2017, he uses mathematics to explain why neural networks work.

In 2025, he received the CNRS Gold Medal.',
  NULL, NULL,
  '/portraits/stephane-mallat.webp', 'Photo : Jérémy Barande, CC BY-SA 2.0, via Wikimedia Commons', '[{"label":"Chaire Sciences des données, Collège de France","url":"https://www.college-de-france.fr/fr/chaire/stephane-mallat-sciences-des-donnees-chaire-statutaire"},{"label":"Stéphane Mallat, CNRS","url":"https://www.cnrs.fr/fr/personne/stephane-mallat"},{"label":"Wikipédia","url":"https://fr.wikipedia.org/wiki/Stéphane_Mallat"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'michael-wooldridge', 76, 'Michael Wooldridge', 'Professeur, chaire Ashall de fondations de l''IA', 'Ashall Professor of Foundations of AI',
  'University of Oxford', 'GB', 'culture',
  'Professeur à Oxford, il étudie les systèmes multi-agents et explique l''IA au grand public, notamment lors des Christmas Lectures de la Royal Institution en 2023.', 'An Oxford professor, he studies multi-agent systems and explains AI to the public, notably in the Royal Institution Christmas Lectures in 2023.', 'Michael Wooldridge est titulaire de la chaire Ashall de fondations de l''intelligence artificielle à Oxford. Formé à Wolverhampton Polytechnic (licence, 1989) puis à l''UMIST (doctorat, 1991), il a dirigé le département d''informatique d''Oxford de 2014 à 2018.\n\nIl travaille sur les systèmes multi-agents : des programmes autonomes qui coopèrent ou négocient. Il a présidé l''IJCAI, grande conférence internationale d''IA (2015-2017), et l''association européenne d''IA, EurAI (2014-2016).\n\nEn 2025, il reçoit le prix Michael Faraday de la Royal Society ; en 2026, il en est élu membre.', 'Michael Wooldridge holds the Ashall Chair of the Foundations of Artificial Intelligence at Oxford. Trained at Wolverhampton Polytechnic (BSc, 1989) then UMIST (PhD, 1991), he chaired Oxford''s Department of Computer Science from 2014 to 2018.\n\nHe works on multi-agent systems: autonomous programs that cooperate or negotiate. He was president of IJCAI, a leading international AI conference (2015-2017), and of the European Association for AI, EurAI (2014-2016).\n\nIn 2025, he received the Royal Society''s Michael Faraday Prize; in 2026, he was elected a Fellow of the Society.',
  NULL, NULL,
  '/portraits/michael-wooldridge.webp', 'Photo : Mateusz Malta, CC BY-SA 4.0, via Wikimedia Commons', '[{"label":"Page Oxford Computer Science","url":"https://www.cs.ox.ac.uk/people/michael.wooldridge/"},{"label":"Profil Hertford College","url":"https://www.hertford.ox.ac.uk/staff-profiles/professor-michael-wooldridge/"},{"label":"Wikipédia","url":"https://en.wikipedia.org/wiki/Michael_Wooldridge_(computer_scientist)"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'mark-coeckelbergh', 77, 'Mark Coeckelbergh', 'Professeur de philosophie des médias et de la technologie', 'Professor of Philosophy of Media and Technology',
  'Université de Vienne', 'AT', 'culture',
  'Philosophe belge, il étudie ce que l''IA fait à nos sociétés et à la démocratie, et siège dans des instances européennes et à l''ONU consacrées à l''IA.', 'Belgian philosopher, he studies what AI does to our societies and to democracy, and sits on European and UN bodies devoted to AI.', 'Né en 1975 à Louvain, Mark Coeckelbergh étudie les sciences sociales à la KU Leuven, puis la philosophie à East Anglia et à Birmingham. Il enseigne à De Montfort University de 2014 à 2019.

Depuis 2015, il est professeur de philosophie des médias et de la technologie à l''Université de Vienne. Il a siégé au groupe d''experts de haut niveau sur l''IA de la Commission européenne. Son livre « Why AI Undermines Democracy and What To Do About It » (Polity) examine les risques de l''IA pour la démocratie.

En 2026, il est nommé au groupe scientifique indépendant de l''ONU sur l''IA et publie « Artificial Religion » (MIT Press).', 'Born in 1975 in Leuven, Mark Coeckelbergh studied social sciences at KU Leuven, then philosophy at East Anglia and Birmingham. He taught at De Montfort University from 2014 to 2019.

Since 2015, he has been Professor of Philosophy of Media and Technology at the University of Vienna. He served on the European Commission''s High-Level Expert Group on AI. His book "Why AI Undermines Democracy and What To Do About It" (Polity) examines the risks AI poses to democracy.

In 2026, he was appointed to the UN Independent Scientific Panel on AI and published "Artificial Religion" (MIT Press).',
  NULL, NULL,
  '/portraits/mark-coeckelbergh.webp', 'Photo : Université de Vienne', '[{"label":"Site personnel","url":"https://coeckelbergh.net/"},{"label":"Groupe scientifique de l''ONU sur l''IA","url":"https://www.un.org/independent-international-scientific-panel-ai/en/panel-members"},{"label":"Wikipédia (EN)","url":"https://en.wikipedia.org/wiki/Mark_Coeckelbergh"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'kai-zenner', 78, 'Kai Zenner', 'Chef de cabinet et conseiller en politique numérique', 'Head of Office and Digital Policy Adviser',
  'Parlement européen', 'BE', 'culture',
  'Chef de cabinet et conseiller en politique numérique de l''eurodéputé Axel Voss, il participe aux négociations européennes sur l''AI Act, le règlement sur l''intelligence artificielle.', 'Head of office and digital policy adviser to MEP Axel Voss, he takes part in the European negotiations on the AI Act, the regulation on artificial intelligence.', 'Kai Zenner étudie les sciences politiques à Brême, le droit à Fribourg, York et Münster, puis les relations internationales à Édimbourg. Il a aussi été chercheur associé au bureau européen de la Fondation Konrad-Adenauer, à Bruxelles.

Depuis mi-2017, il travaille au Parlement européen auprès de l''eurodéputé Axel Voss (groupe PPE), dont il dirige le bureau. Il participe aux négociations sur l''AI Act, la loi européenne sur l''IA, ainsi qu''à celles sur la directive sur la responsabilité en matière d''IA et le règlement ePrivacy (vie privée en ligne).

En 2026, son blog publie des analyses sur l''« omnibus » de l''AI Act et sur l''application des règles numériques européennes.', 'Kai Zenner studied political science in Bremen, law in Freiburg, York and Münster, then international relations in Edinburgh. He has also been a research associate at the European office of the Konrad Adenauer Foundation in Brussels.

Since mid-2017, he has worked in the European Parliament for MEP Axel Voss (EPP group), whose office he heads. He takes part in negotiations on the AI Act, the EU''s AI law, as well as those on the AI liability directive and the ePrivacy regulation (online privacy).

In 2026, his blog publishes analyses of the AI Act "omnibus" and of the enforcement of European digital rules.',
  NULL, NULL,
  '/portraits/kai-zenner.webp', 'Photo : Kai Zenner', '[{"label":"Site personnel de Kai Zenner","url":"https://www.kaizenner.eu"},{"label":"Profil OECD.AI","url":"https://oecd.ai/en/community/kai-zenner"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'henna-virkkunen', 79, 'Henna Virkkunen', 'Vice-présidente exécutive, souveraineté technologique', 'Executive Vice-President, Tech Sovereignty',
  'Commission européenne', 'FI', 'culture',
  'Vice-présidente exécutive de la Commission européenne, elle pilote la politique de l''UE sur l''IA, le cloud et le numérique, et fait appliquer les règles sur les grandes plateformes.', 'Executive Vice-President of the European Commission, she leads EU policy on AI, cloud and digital, and oversees enforcement of the rules on large online platforms.', 'Née en 1972 en Finlande, Henna Virkkunen étudie la communication à l''université de Jyväskylä. Elle siège au Parlement finlandais de 2007 à 2014, ministre de l''Éducation à partir de 2008, puis au Parlement européen de 2014 à 2024.

Depuis fin 2024, elle est vice-présidente exécutive de la Commission européenne. Son portefeuille couvre la stratégie « Apply AI », une future loi sur le cloud et le développement de l''IA, et l''application des règlements sur les services et marchés numériques.

Entre décembre 2024 et octobre 2025, l''UE a sélectionné 19 « usines d''IA » : des sites qui réunissent supercalculateurs, données et talents.', 'Born in 1972 in Finland, Henna Virkkunen studied communication at the University of Jyväskylä. She sat in the Finnish Parliament from 2007 to 2014, as Minister of Education from 2008, then in the European Parliament from 2014 to 2024.

Since late 2024, she has been Executive Vice-President of the European Commission. Her portfolio covers the Apply AI strategy, a planned Cloud and AI Development Act, and enforcement of the Digital Services and Digital Markets Acts.

Between December 2024 and October 2025, the EU selected 19 "AI Factories": sites that bring together supercomputers, data and talent.',
  NULL, NULL,
  '/portraits/henna-virkkunen.webp', '© Union européenne 2024 – Source : PE', '[{"label":"Profil officiel, Commission européenne","url":"https://commission.europa.eu/about/organisation/college-commissioners/henna-virkkunen_en"},{"label":"Wikipédia","url":"https://en.wikipedia.org/wiki/Henna_Virkkunen"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'lucilla-sioli', 80, 'Lucilla Sioli', 'Directrice de l''Office européen de l''IA', 'Director of the European AI Office',
  'Commission européenne (DG CONNECT)', 'BE', 'culture',
  'Elle dirige l''Office européen de l''IA, chargé de faire appliquer le règlement européen sur l''IA, notamment pour les modèles d''IA à usage général.', 'She heads the European AI Office, which enforces the EU AI Act, notably for general-purpose AI models.', 'Économiste italienne, Lucilla Sioli est fonctionnaire de la Commission européenne depuis 1997. Elle a étudié à l''Université de Southampton et à l''Université catholique du Sacré-Cœur.

Elle dirigeait la direction « IA et industrie numérique » de la DG CONNECT quand la Commission l''a placée, le 29 mai 2024, à la tête de l''Office européen de l''IA. L''Office, effectif le 16 juin 2024, veille à l''application de l''AI Act, la loi européenne sur l''IA.

En 2025, la Commission a publié le code de bonnes pratiques pour l''IA à usage général (10 juillet), avant l''entrée en application des obligations correspondantes (2 août).', 'Italian economist Lucilla Sioli has been a European Commission official since 1997. She studied at the University of Southampton and the Catholic University of the Sacred Heart.

She was Director for AI and Digital Industry at DG CONNECT when the Commission put her in charge of the European AI Office on 29 May 2024. The Office, effective 16 June 2024, oversees the AI Act, the EU''s AI law.

In 2025, the Commission published the code of practice for general-purpose AI (10 July), ahead of the start of the related obligations (2 August).',
  NULL, NULL,
  '/portraits/lucilla-sioli.webp', 'Photo : Commission européenne', '[{"label":"Office européen de l''IA","url":"https://digital-strategy.ec.europa.eu/en/policies/ai-office"},{"label":"Wikidata","url":"https://www.wikidata.org/wiki/Q135841139"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'jade-leung', 81, 'Jade Leung', 'Directrice technique et conseillère IA du Premier ministre', 'Chief Technology Officer and Prime Minister''s AI Adviser',
  'AI Security Institute', 'GB', 'culture',
  'Directrice technique de l''AI Security Institute britannique et conseillère IA du Premier ministre, elle travaille à évaluer les risques des modèles d''IA les plus avancés.', 'Chief technology officer of the UK''s AI Security Institute and AI adviser to the Prime Minister, she works on assessing the risks of the most advanced AI models.', 'Ingénieure civile de formation (université d''Auckland, 2015), Jade Leung est boursière Rhodes en 2016, puis obtient en 2019 un doctorat en relations internationales à Oxford, consacré à l''histoire de la politique stratégique des technologies émergentes.\n\nCofondatrice du Centre for the Governance of AI à Oxford, elle dirige ensuite la gouvernance chez OpenAI, jusqu''en octobre 2023.\n\nDepuis, elle est directrice technique de l''AI Security Institute, l''organisme public britannique qui évalue les risques de l''IA avancée. En 2025, elle devient aussi conseillère IA du Premier ministre.', 'A civil engineer by training (University of Auckland, 2015), Jade Leung became a Rhodes Scholar in 2016, then earned a DPhil in international relations at Oxford in 2019, on the history of the strategic politics of emerging technologies.\n\nA co-founder of the Centre for the Governance of AI at Oxford, she went on to lead governance at OpenAI until October 2023.\n\nSince then, she has been chief technology officer of the AI Security Institute, the UK public body that assesses the risks of advanced AI. In 2025, she also became the Prime Minister''s AI adviser.',
  NULL, NULL,
  '/portraits/jade-leung.webp', 'Photo : New Zealand Government, Office of the Governor-General, CC BY 4.0, via Wikimedia Commons', '[{"label":"AI Security Institute","url":"https://www.aisi.gov.uk/"},{"label":"Wikipédia (en)","url":"https://en.wikipedia.org/wiki/Jade_Leung_(engineer)"},{"label":"GovAI","url":"https://www.governance.ai/team/jade-leung"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'eva-maydell', 82, 'Eva Maydell', 'Députée européenne', 'Member of the European Parliament',
  'Parlement européen', 'BE', 'culture',
  'Députée européenne bulgare, l''une des négociatrices principales de l''AI Act, le règlement européen sur l''IA. Elle promeut un outil de consentement pour l''usage de l''identité par l''IA.', 'Bulgarian MEP and one of the lead negotiators of the AI Act, the EU regulation on AI. She promotes a consent tool for the use of identity by AI.', 'Née à Sofia en 1986, Eva Maydell est diplômée d''un bachelor de la John Cabot University, à Rome. Elle est élue au Parlement européen en juillet 2014, à 28 ans, pour le parti bulgare GERB, au sein du Parti populaire européen (PPE).

Elle siège à la commission de l''industrie, de la recherche et de l''énergie, et a coordonné le PPE à la commission spéciale sur l''IA. Elle a présidé le Mouvement européen international de 2017 à 2023.

Le 23 juin 2026, elle présente au Parlement européen, à Bruxelles, avec l''actrice Cate Blanchett, un registre public où chacun indique si une IA peut utiliser son image ou sa voix.', 'Born in Sofia in 1986, Eva Maydell holds a bachelor''s degree from John Cabot University in Rome. She was elected to the European Parliament in July 2014, aged 28, for Bulgaria''s GERB party, within the European People''s Party (EPP).

She sits on the Industry, Research and Energy Committee and coordinated the EPP in the special committee on AI. She chaired the International European Movement from 2017 to 2023.

On 23 June 2026, she presented at the European Parliament in Brussels, with actor Cate Blanchett, a public registry where anyone states whether an AI may use their image or voice.',
  'un outil qui rend les droits transparents, renforce la confiance à grande échelle et maintient la créativité humaine au centre du progrès technologique', 'a tool that makes rights transparent, scales trust, and keeps human creativity at the centre of technological progress',
  '/portraits/eva-maydell.webp', 'Photo : European People''s Party, CC BY 2.0, via Wikimedia Commons', '[{"label":"Article Wikipédia","url":"https://en.wikipedia.org/wiki/Eva_Maydell"},{"label":"Site personnel","url":"https://www.evamaydell.eu"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'axel-voss', 83, 'Axel Voss', 'Député européen (CDU/PPE)', 'Member of the European Parliament (CDU/EPP)',
  'Parlement européen', 'DE', 'culture',
  'Député européen allemand, il porte au Parlement les règles sur le droit d''auteur face à l''IA générative et plaide pour la souveraineté numérique de l''Europe.', 'German MEP, he leads Parliament''s work on copyright rules for generative AI and argues for Europe''s digital sovereignty.', 'Juriste de formation (Trèves, Munich, Fribourg), né en 1963 à Hameln, Axel Voss siège au Parlement européen depuis 2009, sous l''étiquette CDU. Depuis 2017, il coordonne le groupe PPE à la commission des affaires juridiques.

Il a été rapporteur de la réforme européenne du droit d''auteur et a siégé à la commission spéciale sur l''IA. Il alerte sur le risque d''une Europe dépendante du numérique américain ou chinois.

Le 11 mars 2026, le Parlement a adopté son rapport sur le droit d''auteur et l''IA générative (360 voix contre 71) : transparence sur les données d''entraînement, licences pour les créateurs.', 'A lawyer by training (Trier, Munich, Freiburg), born in 1963 in Hamelin, Axel Voss has sat in the European Parliament since 2009 for the CDU. Since 2017, he has coordinated the EPP group on the Legal Affairs Committee.

He was rapporteur on the EU copyright reform and served on the special committee on AI. He warns against a Europe dependent on American or Chinese digital technology.

On 11 March 2026, Parliament adopted his report on copyright and generative AI (360 votes to 71): transparency on training data, licences for creators.',
  NULL, NULL,
  '/portraits/axel-voss.webp', '© Union européenne 2024 – Source : PE', '[{"label":"Site officiel d''Axel Voss","url":"https://www.axel-voss-europa.de/"},{"label":"Wikipédia","url":"https://fr.wikipedia.org/wiki/Axel_Voss"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'francesca-bria', 84, 'Francesca Bria', 'Professeure honoraire, économiste de l''innovation', 'Honorary Professor, innovation economist',
  'UCL Institute for Innovation and Public Purpose', 'IT', 'culture',
  'Économiste de l''innovation, elle a dirigé la technologie de Barcelone puis un fonds public italien, et défend une souveraineté numérique européenne.', 'An innovation economist, she ran Barcelona''s technology policy, then an Italian public fund, and argues for European digital sovereignty.', 'Formée à Rome, puis à University College London et à Imperial College London (doctorat en économie de l''innovation), Francesca Bria passe huit ans à Nesta, agence britannique d''innovation.

De 2016 à 2020, elle dirige la technologie et l''innovation de la ville de Barcelone, puis préside de 2020 à 2024 le fonds public italien d''innovation.

En février 2025, elle cosigne le rapport EuroStack : plus de 80 % des technologies numériques européennes sont importées. Elle siège au Conseil européen de l''innovation depuis 2025.', 'Trained in Rome, then at University College London and Imperial College London (PhD in innovation economics), Francesca Bria spends eight years at Nesta, a UK innovation agency.

From 2016 to 2020, she leads technology and innovation for the city of Barcelona, then chairs Italy''s public innovation fund from 2020 to 2024.

In February 2025, she co-authors the EuroStack report: over 80% of Europe''s digital technologies are imported. She has sat on the European Innovation Council board since 2025.',
  NULL, NULL,
  '/portraits/francesca-bria.webp', 'Photo : Martin Kraft, CC BY-SA 4.0, via Wikimedia Commons', '[{"label":"Article Wikipédia","url":"https://en.wikipedia.org/wiki/Francesca_Bria"},{"label":"Site EuroStack","url":"https://eurostack.eu"},{"label":"Rapport EuroStack (Bertelsmann Stiftung)","url":"https://www.bertelsmann-stiftung.de/en/publications/publication/did/eurostack-a-european-alternative-for-digital-sovereignty"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  'gabriel-peyre', 93, 'Gabriel Peyré', 'Directeur de recherche en intelligence artificielle', 'Research Director in Artificial Intelligence',
  'CNRS', 'FR', 'culture',
  'Mathématicien au CNRS et à l''ENS, il relie transport optimal et apprentissage profond, et dirige le centre ENS de science des données et l''unité ELLIS Paris.', 'A mathematician at CNRS and ENS, he links optimal transport and deep learning, and directs the ENS Center for Data Science and the ELLIS Paris unit.', 'Docteur en mathématiques de l''École polytechnique (2005), il rejoint le CNRS en 2006. Il travaille aujourd''hui au département de mathématiques et applications de l''École normale supérieure. Médaille d''argent du CNRS en 2021.

Sa spécialité, le transport optimal : la manière la plus économe de déplacer un ensemble de points vers un autre. Il l''applique à l''image et à l''apprentissage automatique.

Depuis octobre 2024, il dirige WOLF, projet financé jusqu''en 2029 par une bourse ERC de 2,5 millions d''euros, sur le développement des cellules. Le 20 avril 2026, il intervient à l''Assemblée nationale sur l''IA dans la recherche.', 'He earned a PhD in mathematics from École polytechnique (2005) and joined CNRS in 2006. He now works in the Department of Mathematics and Applications at the École normale supérieure. He received the CNRS Silver Medal in 2021.

His specialty is optimal transport: the most economical way to move one set of points onto another. He applies it to imaging and machine learning.

Since October 2024 he has led WOLF, a project funded until 2029 by a 2.5 million euro ERC grant, on the development of cells. On 20 April 2026, he spoke at the French National Assembly on AI in research.',
  NULL, NULL,
  '/portraits/gabriel-peyre.webp', 'Photo : CNRS', '[{"label":"Page personnelle","url":"https://www.gpeyre.com/"},{"label":"Profil CNRS","url":"https://www.cnrs.fr/fr/personne/gabriel-peyre"},{"label":"Wikipédia","url":"https://en.wikipedia.org/wiki/Gabriel_Peyré"}]'::jsonb, false, false
)
on conflict (id) do update set
  ord = excluded.ord,
  name = excluded.name,
  role_fr = excluded.role_fr,
  role_en = excluded.role_en,
  organization = excluded.organization,
  country = excluded.country,
  wing = excluded.wing,
  bio_fr = excluded.bio_fr,
  bio_en = excluded.bio_en,
  story_fr = excluded.story_fr,
  story_en = excluded.story_en,
  quote_fr = excluded.quote_fr,
  quote_en = excluded.quote_en,
  photo_url = excluded.photo_url,
  photo_credit = excluded.photo_credit,
  links = excluded.links,
  placeholder = excluded.placeholder,
  updated_at = now();

commit;
