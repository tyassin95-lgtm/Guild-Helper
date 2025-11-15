/**
 * Trivia questions database
 * Each question has 4 options with one correct answer
 */

const TRIVIA_QUESTIONS = [
  // Gaming Category
  {
    question: "What year was the original Super Mario Bros. released?",
    options: ["1983", "1985", "1987", "1989"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "Which company developed the game 'The Witcher 3'?",
    options: ["CD Projekt Red", "Bethesda", "BioWare", "Ubisoft"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "In Minecraft, how many blocks are needed to build a Nether Portal?",
    options: ["10", "12", "14", "16"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "hard"
  },
  {
    question: "What is the best-selling video game of all time?",
    options: ["Tetris", "Minecraft", "GTA V", "Wii Sports"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "What is Master Chief's real name in Halo?",
    options: ["John-117", "Sam-034", "Kelly-087", "Fred-104"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "Which game series features a character named 'Kratos'?",
    options: ["Devil May Cry", "God of War", "Dark Souls", "Bayonetta"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "In League of Legends, how many champions were available at launch?",
    options: ["20", "30", "40", "50"],
    correctIndex: 2,
    category: "Gaming",
    difficulty: "hard"
  },
  {
    question: "What is the name of the princess in The Legend of Zelda?",
    options: ["Peach", "Daisy", "Zelda", "Rosalina"],
    correctIndex: 2,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "Which Pokémon is #001 in the National Pokédex?",
    options: ["Pikachu", "Bulbasaur", "Charmander", "Squirtle"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "What year was Fortnite Battle Royale released?",
    options: ["2015", "2016", "2017", "2018"],
    correctIndex: 2,
    category: "Gaming",
    difficulty: "medium"
  },

  // Movies/TV Category
  {
    question: "Who directed the movie 'Inception'?",
    options: ["Steven Spielberg", "Christopher Nolan", "James Cameron", "Quentin Tarantino"],
    correctIndex: 1,
    category: "Movies",
    difficulty: "easy"
  },
  {
    question: "What is the highest-grossing film of all time?",
    options: ["Avatar", "Avengers: Endgame", "Titanic", "Star Wars: The Force Awakens"],
    correctIndex: 0,
    category: "Movies",
    difficulty: "medium"
  },
  {
    question: "In Breaking Bad, what is Walter White's alias?",
    options: ["Heisenberg", "Scarface", "Capone", "The Cook"],
    correctIndex: 0,
    category: "TV",
    difficulty: "easy"
  },
  {
    question: "How many seasons of Game of Thrones are there?",
    options: ["6", "7", "8", "9"],
    correctIndex: 2,
    category: "TV",
    difficulty: "easy"
  },
  {
    question: "Which actor played Iron Man in the MCU?",
    options: ["Chris Evans", "Chris Hemsworth", "Robert Downey Jr.", "Mark Ruffalo"],
    correctIndex: 2,
    category: "Movies",
    difficulty: "easy"
  },
  {
    question: "What year was the first Star Wars movie released?",
    options: ["1975", "1977", "1979", "1981"],
    correctIndex: 1,
    category: "Movies",
    difficulty: "medium"
  },
  {
    question: "In The Office (US), what is Michael Scott's middle name?",
    options: ["Gary", "Gregory", "George", "Gerald"],
    correctIndex: 0,
    category: "TV",
    difficulty: "hard"
  },
  {
    question: "Who composed the music for The Lord of the Rings trilogy?",
    options: ["Hans Zimmer", "John Williams", "Howard Shore", "James Horner"],
    correctIndex: 2,
    category: "Movies",
    difficulty: "medium"
  },
  {
    question: "What is the name of the fictional African country in Black Panther?",
    options: ["Wakanda", "Zamunda", "Genosha", "Latveria"],
    correctIndex: 0,
    category: "Movies",
    difficulty: "easy"
  },
  {
    question: "In Stranger Things, what game do the kids play?",
    options: ["Magic: The Gathering", "Dungeons & Dragons", "Warhammer", "Yu-Gi-Oh!"],
    correctIndex: 1,
    category: "TV",
    difficulty: "easy"
  },

  // Science Category
  {
    question: "What is the chemical symbol for gold?",
    options: ["Go", "Gd", "Au", "Ag"],
    correctIndex: 2,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "How many bones are in the adult human body?",
    options: ["186", "206", "226", "246"],
    correctIndex: 1,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What is the speed of light in vacuum?",
    options: ["299,792 km/s", "199,792 km/s", "399,792 km/s", "499,792 km/s"],
    correctIndex: 0,
    category: "Science",
    difficulty: "hard"
  },
  {
    question: "What planet is closest to the Sun?",
    options: ["Venus", "Mercury", "Mars", "Earth"],
    correctIndex: 1,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What is H2O commonly known as?",
    options: ["Oxygen", "Hydrogen", "Water", "Carbon Dioxide"],
    correctIndex: 2,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "Who developed the theory of relativity?",
    options: ["Isaac Newton", "Albert Einstein", "Stephen Hawking", "Niels Bohr"],
    correctIndex: 1,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What is the largest organ in the human body?",
    options: ["Heart", "Liver", "Brain", "Skin"],
    correctIndex: 3,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "How many planets are in our solar system?",
    options: ["7", "8", "9", "10"],
    correctIndex: 1,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What gas do plants absorb from the atmosphere?",
    options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"],
    correctIndex: 2,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What is the powerhouse of the cell?",
    options: ["Nucleus", "Ribosome", "Mitochondria", "Chloroplast"],
    correctIndex: 2,
    category: "Science",
    difficulty: "medium"
  },

  // History Category
  {
    question: "In what year did World War II end?",
    options: ["1943", "1944", "1945", "1946"],
    correctIndex: 2,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "Who was the first President of the United States?",
    options: ["Thomas Jefferson", "George Washington", "John Adams", "Benjamin Franklin"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "What year did the Titanic sink?",
    options: ["1910", "1911", "1912", "1913"],
    correctIndex: 2,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "Which ancient wonder of the world still stands today?",
    options: ["Hanging Gardens", "Colossus of Rhodes", "Great Pyramid of Giza", "Lighthouse of Alexandria"],
    correctIndex: 2,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "Who painted the Mona Lisa?",
    options: ["Michelangelo", "Leonardo da Vinci", "Raphael", "Donatello"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "What year did the Berlin Wall fall?",
    options: ["1987", "1988", "1989", "1990"],
    correctIndex: 2,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "Who was the first man to walk on the moon?",
    options: ["Buzz Aldrin", "Neil Armstrong", "Yuri Gagarin", "Alan Shepard"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "Which empire was ruled by Julius Caesar?",
    options: ["Greek Empire", "Roman Empire", "Persian Empire", "Ottoman Empire"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "What year did Christopher Columbus reach the Americas?",
    options: ["1490", "1492", "1494", "1496"],
    correctIndex: 1,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "Who wrote the Declaration of Independence?",
    options: ["George Washington", "Benjamin Franklin", "Thomas Jefferson", "John Adams"],
    correctIndex: 2,
    category: "History",
    difficulty: "medium"
  },

  // Geography Category
  {
    question: "What is the capital of France?",
    options: ["London", "Paris", "Berlin", "Madrid"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "Which is the largest ocean on Earth?",
    options: ["Atlantic", "Indian", "Arctic", "Pacific"],
    correctIndex: 3,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "How many continents are there?",
    options: ["5", "6", "7", "8"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "What is the longest river in the world?",
    options: ["Amazon", "Nile", "Yangtze", "Mississippi"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "Which country has the largest population?",
    options: ["India", "China", "United States", "Indonesia"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "What is the smallest country in the world?",
    options: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "Mount Everest is located in which mountain range?",
    options: ["Alps", "Andes", "Rockies", "Himalayas"],
    correctIndex: 3,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "What is the capital of Australia?",
    options: ["Sydney", "Melbourne", "Canberra", "Brisbane"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "Which desert is the largest in the world?",
    options: ["Sahara", "Arabian", "Gobi", "Antarctic"],
    correctIndex: 3,
    category: "Geography",
    difficulty: "hard"
  },
  {
    question: "What country is known as the Land of the Rising Sun?",
    options: ["China", "Korea", "Japan", "Thailand"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "easy"
  },

  // Random/Fun Category
  {
    question: "What is the most popular social media platform?",
    options: ["Twitter", "Instagram", "Facebook", "TikTok"],
    correctIndex: 2,
    category: "Random",
    difficulty: "easy"
  },
  {
    question: "How many colors are in a rainbow?",
    options: ["5", "6", "7", "8"],
    correctIndex: 2,
    category: "Random",
    difficulty: "easy"
  },
  {
    question: "What is the fear of spiders called?",
    options: ["Arachnophobia", "Claustrophobia", "Acrophobia", "Agoraphobia"],
    correctIndex: 0,
    category: "Random",
    difficulty: "medium"
  },
  {
    question: "How many sides does a hexagon have?",
    options: ["4", "5", "6", "7"],
    correctIndex: 2,
    category: "Random",
    difficulty: "easy"
  },
  {
    question: "What is the hardest natural substance on Earth?",
    options: ["Gold", "Iron", "Diamond", "Titanium"],
    correctIndex: 2,
    category: "Random",
    difficulty: "medium"
  },
  {
    question: "How many minutes are in a week?",
    options: ["10,080", "10,800", "11,080", "11,800"],
    correctIndex: 0,
    category: "Random",
    difficulty: "hard"
  },
  {
    question: "What do you call a baby kangaroo?",
    options: ["Cub", "Joey", "Kit", "Pup"],
    correctIndex: 1,
    category: "Random",
    difficulty: "medium"
  },
  {
    question: "How many hearts does an octopus have?",
    options: ["1", "2", "3", "4"],
    correctIndex: 2,
    category: "Random",
    difficulty: "hard"
  },
  {
    question: "What is the largest mammal in the world?",
    options: ["Elephant", "Blue Whale", "Giraffe", "Polar Bear"],
    correctIndex: 1,
    category: "Random",
    difficulty: "easy"
  },
  {
    question: "How many teeth does an adult human have?",
    options: ["28", "30", "32", "34"],
    correctIndex: 2,
    category: "Random",
    difficulty: "medium"
  },

  // More Gaming
  {
    question: "What is the currency in Roblox called?",
    options: ["Coins", "Gems", "Robux", "Credits"],
    correctIndex: 2,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "In Among Us, what is the maximum number of impostors?",
    options: ["1", "2", "3", "4"],
    correctIndex: 2,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "What company owns Riot Games?",
    options: ["Microsoft", "Tencent", "Sony", "EA"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "hard"
  },
  {
    question: "In Valorant, how many players are on each team?",
    options: ["4", "5", "6", "7"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "What is the name of the battle royale mode in Call of Duty?",
    options: ["Warzone", "Battle Royale", "Blackout", "Firebase"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "Which game features the character 'Sonic'?",
    options: ["Nintendo", "Sega", "Sony", "Microsoft"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "What year was Steam launched?",
    options: ["2001", "2003", "2005", "2007"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "hard"
  },
  {
    question: "In Overwatch, which hero can resurrect teammates?",
    options: ["Ana", "Mercy", "Moira", "Brigitte"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "What is the main character's name in The Last of Us?",
    options: ["Nathan", "Joel", "Ellie", "Tommy"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "Which game popularized the battle royale genre?",
    options: ["PUBG", "Fortnite", "Apex Legends", "H1Z1"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "What is the max level in Elden Ring?",
    options: ["99", "120", "713", "999"],
    correctIndex: 2,
    category: "Gaming",
    difficulty: "hard"
  },
  {
    question: "In Counter-Strike, what does 'ACE' mean?",
    options: ["All enemies killed by one player", "Perfect headshot", "Winning without losing rounds", "5 kills in 5 seconds"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "What company created the Unreal Engine?",
    options: ["Unity", "Epic Games", "Valve", "id Software"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "In Rocket League, how many players are on each team in standard mode?",
    options: ["2", "3", "4", "5"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "What is the highest rank in Valorant?",
    options: ["Radiant", "Immortal", "Champion", "Apex"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "In Dark Souls, what is the name of the tutorial boss?",
    options: ["Asylum Demon", "Taurus Demon", "Capra Demon", "Demon Firesage"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "hard"
  },
  {
    question: "What year was Apex Legends released?",
    options: ["2017", "2018", "2019", "2020"],
    correctIndex: 2,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "In Skyrim, what is the name of the main theme song?",
    options: ["Fus Ro Dah", "Dragonborn", "Dovahkiin", "The Elder Scrolls"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "What is the currency in Animal Crossing called?",
    options: ["Coins", "Bells", "Leaves", "Stars"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "In Dota 2, how many heroes were available at launch?",
    options: ["90", "100", "110", "120"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "hard"
  },
  {
    question: "What is the best-selling Nintendo Switch game?",
    options: ["Animal Crossing", "Zelda: BOTW", "Mario Kart 8", "Super Smash Bros"],
    correctIndex: 2,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "In Fallout, what is a Vault-Tec Vault?",
    options: ["Bank", "Bunker", "Vehicle", "Weapon"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "What is the final evolution of Charmander?",
    options: ["Charmeleon", "Charizard", "Charibolt", "Charflame"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "In Resident Evil, what does S.T.A.R.S. stand for?",
    options: ["Special Tactics And Rescue Service", "Strategic Tactical Attack Response Squad", "Special Tactics And Response Squad", "Special Team Advanced Rescue Service"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "hard"
  },
  {
    question: "What is the name of Link's horse in Zelda?",
    options: ["Zelda", "Ganon", "Epona", "Navi"],
    correctIndex: 2,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "In GTA V, which character is a retired bank robber?",
    options: ["Franklin", "Trevor", "Michael", "Lester"],
    correctIndex: 2,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "What is the rarest block in Minecraft?",
    options: ["Diamond", "Emerald Ore", "Ancient Debris", "Netherite"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "hard"
  },
  {
    question: "In Terraria, what is the final boss?",
    options: ["Wall of Flesh", "Moon Lord", "Plantera", "Eye of Cthulhu"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "What company owns Blizzard Entertainment?",
    options: ["Activision", "Microsoft", "Tencent", "EA"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "In Stardew Valley, how many seasons are there?",
    options: ["2", "3", "4", "5"],
    correctIndex: 2,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "What is the main character's name in Half-Life?",
    options: ["Gordon Freeman", "John Freeman", "Adrian Shephard", "Barney Calhoun"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "In Splatoon, what are players?",
    options: ["Fish", "Octopi", "Squids", "Jellyfish"],
    correctIndex: 2,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "What is the highest selling game on Steam?",
    options: ["PUBG", "CS:GO", "Dota 2", "GTA V"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "hard"
  },
  {
    question: "In Dead by Daylight, how many survivors escape together?",
    options: ["2", "3", "4", "5"],
    correctIndex: 2,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "What year was Roblox released?",
    options: ["2004", "2006", "2008", "2010"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "hard"
  },
  {
    question: "In Hollow Knight, what is the main character?",
    options: ["Knight", "Bug", "Ghost", "Vessel"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "What is the sequel to Portal called?",
    options: ["Portal 2", "Portal Reloaded", "Portal 3", "Portal: Revolution"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "In Rainbow Six Siege, what is the attacking team called?",
    options: ["Attackers", "Offense", "Assault", "Strikers"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "What is the max party size in Final Fantasy XIV?",
    options: ["4", "6", "8", "10"],
    correctIndex: 2,
    category: "Gaming",
    difficulty: "hard"
  },
  {
    question: "In Undertale, what is the main character's default name?",
    options: ["Frisk", "Chara", "Player", "Human"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "medium"
  },

  // More Movies/TV
  {
    question: "Who plays Eleven in Stranger Things?",
    options: ["Sadie Sink", "Millie Bobby Brown", "Natalia Dyer", "Maya Hawke"],
    correctIndex: 1,
    category: "TV",
    difficulty: "easy"
  },
  {
    question: "What is the name of Thor's hammer?",
    options: ["Gungnir", "Mjolnir", "Stormbreaker", "Hofund"],
    correctIndex: 1,
    category: "Movies",
    difficulty: "medium"
  },
  {
    question: "How many Harry Potter movies are there?",
    options: ["6", "7", "8", "9"],
    correctIndex: 2,
    category: "Movies",
    difficulty: "easy"
  },
  {
    question: "In Friends, what is Joey's catchphrase?",
    options: ["How you doin'?", "We were on a break!", "Pivot!", "Oh. My. God."],
    correctIndex: 0,
    category: "TV",
    difficulty: "easy"
  },
  {
    question: "Who directed Pulp Fiction?",
    options: ["Martin Scorsese", "Quentin Tarantino", "Steven Spielberg", "Francis Ford Coppola"],
    correctIndex: 1,
    category: "Movies",
    difficulty: "medium"
  },
  {
    question: "What is Walter White's profession in Breaking Bad?",
    options: ["Chemist", "Teacher", "Pharmacist", "Scientist"],
    correctIndex: 1,
    category: "TV",
    difficulty: "easy"
  },
  {
    question: "In The Matrix, what color pill does Neo take?",
    options: ["Red", "Blue", "Green", "Yellow"],
    correctIndex: 0,
    category: "Movies",
    difficulty: "easy"
  },
  {
    question: "How many Infinity Stones are there?",
    options: ["4", "5", "6", "7"],
    correctIndex: 2,
    category: "Movies",
    difficulty: "easy"
  },
  {
    question: "What streaming service is The Witcher on?",
    options: ["Hulu", "Amazon Prime", "Netflix", "Disney+"],
    correctIndex: 2,
    category: "TV",
    difficulty: "easy"
  },
  {
    question: "Who directed The Dark Knight?",
    options: ["Zack Snyder", "Christopher Nolan", "Tim Burton", "James Gunn"],
    correctIndex: 1,
    category: "Movies",
    difficulty: "medium"
  },
  {
    question: "What is the name of Jon Snow's direwolf?",
    options: ["Grey Wind", "Ghost", "Shaggydog", "Summer"],
    correctIndex: 1,
    category: "TV",
    difficulty: "medium"
  },
  {
    question: "In The Mandalorian, what is Baby Yoda's real name?",
    options: ["Yoda Jr.", "Grogu", "Mando", "The Child"],
    correctIndex: 1,
    category: "TV",
    difficulty: "easy"
  },
  {
    question: "Who played Joker in The Dark Knight?",
    options: ["Jared Leto", "Joaquin Phoenix", "Heath Ledger", "Jack Nicholson"],
    correctIndex: 2,
    category: "Movies",
    difficulty: "easy"
  },
  {
    question: "How many seasons does The Walking Dead have?",
    options: ["9", "10", "11", "12"],
    correctIndex: 2,
    category: "TV",
    difficulty: "medium"
  },
  {
    question: "What is the highest-grossing R-rated movie?",
    options: ["Joker", "Deadpool", "The Matrix", "Logan"],
    correctIndex: 0,
    category: "Movies",
    difficulty: "hard"
  },
  {
    question: "In Rick and Morty, what is Rick's last name?",
    options: ["Smith", "Sanchez", "Johnson", "Garcia"],
    correctIndex: 1,
    category: "TV",
    difficulty: "medium"
  },
  {
    question: "What year was the first Avengers movie released?",
    options: ["2010", "2011", "2012", "2013"],
    correctIndex: 2,
    category: "Movies",
    difficulty: "medium"
  },
  {
    question: "In Breaking Bad, what is Jesse Pinkman's catchphrase?",
    options: ["Yeah science!", "Yo", "Yeah, bitch!", "Magnets"],
    correctIndex: 0,
    category: "TV",
    difficulty: "medium"
  },
  {
    question: "Who directed Jurassic Park?",
    options: ["James Cameron", "Steven Spielberg", "George Lucas", "Ridley Scott"],
    correctIndex: 1,
    category: "Movies",
    difficulty: "easy"
  },
  {
    question: "What is Darth Vader's real name?",
    options: ["Luke Skywalker", "Anakin Skywalker", "Ben Solo", "Obi-Wan Kenobi"],
    correctIndex: 1,
    category: "Movies",
    difficulty: "easy"
  },
  {
    question: "In Squid Game, what is the first game played?",
    options: ["Tug of War", "Red Light Green Light", "Honeycomb", "Marbles"],
    correctIndex: 1,
    category: "TV",
    difficulty: "easy"
  },
  {
    question: "How many Lord of the Rings movies are there?",
    options: ["2", "3", "4", "5"],
    correctIndex: 1,
    category: "Movies",
    difficulty: "easy"
  },
  {
    question: "What is the name of the island in Lost?",
    options: ["Mystery Island", "The Island", "Dharma Island", "Purgatory"],
    correctIndex: 1,
    category: "TV",
    difficulty: "medium"
  },
  {
    question: "Who voices Woody in Toy Story?",
    options: ["Tim Allen", "Tom Hanks", "Billy Crystal", "John Goodman"],
    correctIndex: 1,
    category: "Movies",
    difficulty: "easy"
  },
  {
    question: "In The Witcher, what is Geralt's nickname?",
    options: ["White Wolf", "Silver Fox", "Black Cat", "Red Lion"],
    correctIndex: 0,
    category: "TV",
    difficulty: "medium"
  },
  {
    question: "What is the name of the school in Harry Potter?",
    options: ["Beauxbatons", "Durmstrang", "Hogwarts", "Ilvermorny"],
    correctIndex: 2,
    category: "Movies",
    difficulty: "easy"
  },
  {
    question: "Who played Tony Soprano in The Sopranos?",
    options: ["James Gandolfini", "Al Pacino", "Robert De Niro", "Joe Pesci"],
    correctIndex: 0,
    category: "TV",
    difficulty: "medium"
  },
  {
    question: "What is the name of the AI in Iron Man's suit?",
    options: ["Cortana", "JARVIS", "HAL", "FRIDAY"],
    correctIndex: 1,
    category: "Movies",
    difficulty: "medium"
  },
  {
    question: "In The Boys, what is Homelander's weakness?",
    options: ["Kryptonite", "None", "Compound V", "Love"],
    correctIndex: 1,
    category: "TV",
    difficulty: "hard"
  },
  {
    question: "Who directed Avatar?",
    options: ["Peter Jackson", "James Cameron", "Denis Villeneuve", "Ridley Scott"],
    correctIndex: 1,
    category: "Movies",
    difficulty: "easy"
  },
  {
    question: "What year was Breaking Bad released?",
    options: ["2006", "2008", "2010", "2012"],
    correctIndex: 1,
    category: "TV",
    difficulty: "medium"
  },
  {
    question: "In Forrest Gump, what does Forrest say life is like?",
    options: ["A journey", "A box of chocolates", "An adventure", "A dream"],
    correctIndex: 1,
    category: "Movies",
    difficulty: "easy"
  },
  {
    question: "How many dragons does Daenerys start with in Game of Thrones?",
    options: ["1", "2", "3", "4"],
    correctIndex: 2,
    category: "TV",
    difficulty: "easy"
  },
  {
    question: "Who played Wolverine in X-Men?",
    options: ["Ryan Reynolds", "Hugh Jackman", "Chris Hemsworth", "Tom Hardy"],
    correctIndex: 1,
    category: "Movies",
    difficulty: "easy"
  },
  {
    question: "In Peaky Blinders, what is the family name?",
    options: ["Shelby", "Murphy", "O'Connor", "Flanagan"],
    correctIndex: 0,
    category: "TV",
    difficulty: "medium"
  },
  {
    question: "What is the name of the ship in Alien?",
    options: ["Discovery", "Prometheus", "Nostromo", "Covenant"],
    correctIndex: 2,
    category: "Movies",
    difficulty: "hard"
  },
  {
    question: "In Community, what is the study group studying?",
    options: ["Law", "Medicine", "Spanish", "Business"],
    correctIndex: 2,
    category: "TV",
    difficulty: "medium"
  },
  {
    question: "Who directed Interstellar?",
    options: ["Steven Spielberg", "Christopher Nolan", "Denis Villeneuve", "Ridley Scott"],
    correctIndex: 1,
    category: "Movies",
    difficulty: "easy"
  },
  {
    question: "What is Eleven's favorite food in Stranger Things?",
    options: ["Pizza", "Ice Cream", "Waffles", "Burgers"],
    correctIndex: 2,
    category: "TV",
    difficulty: "easy"
  },

  // More Science
  {
    question: "What is the atomic number of carbon?",
    options: ["4", "6", "8", "12"],
    correctIndex: 1,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What force keeps us on the ground?",
    options: ["Magnetism", "Gravity", "Friction", "Inertia"],
    correctIndex: 1,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "How long does it take light from the Sun to reach Earth?",
    options: ["8 seconds", "8 minutes", "8 hours", "8 days"],
    correctIndex: 1,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What is the most abundant gas in Earth's atmosphere?",
    options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"],
    correctIndex: 2,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What is the study of weather called?",
    options: ["Geology", "Meteorology", "Astronomy", "Oceanography"],
    correctIndex: 1,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What particle has a negative charge?",
    options: ["Proton", "Neutron", "Electron", "Photon"],
    correctIndex: 2,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What is the chemical formula for table salt?",
    options: ["NaCl", "KCl", "CaCl2", "MgCl2"],
    correctIndex: 0,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "How many chromosomes do humans have?",
    options: ["23", "44", "46", "48"],
    correctIndex: 2,
    category: "Science",
    difficulty: "hard"
  },
  {
    question: "What type of animal is a Komodo dragon?",
    options: ["Snake", "Lizard", "Crocodile", "Dinosaur"],
    correctIndex: 1,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What is the freezing point of water in Celsius?",
    options: ["-10°C", "0°C", "10°C", "32°C"],
    correctIndex: 1,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What is the smallest unit of life?",
    options: ["Atom", "Molecule", "Cell", "Organ"],
    correctIndex: 2,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What type of animal is a dolphin?",
    options: ["Fish", "Mammal", "Amphibian", "Reptile"],
    correctIndex: 1,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What is the symbol for potassium?",
    options: ["P", "K", "Po", "Pt"],
    correctIndex: 1,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "How many moons does Mars have?",
    options: ["0", "1", "2", "3"],
    correctIndex: 2,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What is the study of fungi called?",
    options: ["Mycology", "Microbiology", "Botany", "Zoology"],
    correctIndex: 0,
    category: "Science",
    difficulty: "hard"
  },
  {
    question: "What planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Mercury"],
    correctIndex: 1,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What is the largest type of star?",
    options: ["White Dwarf", "Red Giant", "Supergiant", "Neutron Star"],
    correctIndex: 2,
    category: "Science",
    difficulty: "hard"
  },
  {
    question: "What is dry ice made of?",
    options: ["Frozen water", "Frozen nitrogen", "Frozen carbon dioxide", "Frozen oxygen"],
    correctIndex: 2,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "How many bones do sharks have?",
    options: ["0", "50", "100", "200"],
    correctIndex: 0,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What is the rarest blood type?",
    options: ["O-", "AB-", "B-", "A-"],
    correctIndex: 1,
    category: "Science",
    difficulty: "hard"
  },
  {
    question: "What is the hottest planet in our solar system?",
    options: ["Mercury", "Venus", "Mars", "Jupiter"],
    correctIndex: 1,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What does DNA stand for?",
    options: ["Deoxyribonucleic Acid", "Diribonucleic Acid", "Deoxyribose Acid", "Dinucleic Acid"],
    correctIndex: 0,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "How many teeth does an adult human have?",
    options: ["28", "30", "32", "34"],
    correctIndex: 2,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What is the study of earthquakes called?",
    options: ["Geology", "Seismology", "Volcanology", "Meteorology"],
    correctIndex: 1,
    category: "Science",
    difficulty: "hard"
  },
  {
    question: "What gas makes up most of the Sun?",
    options: ["Oxygen", "Hydrogen", "Helium", "Carbon"],
    correctIndex: 1,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What is the largest internal organ?",
    options: ["Heart", "Liver", "Stomach", "Lungs"],
    correctIndex: 1,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What is the chemical symbol for iron?",
    options: ["Ir", "Fe", "I", "In"],
    correctIndex: 1,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "How many valves does the human heart have?",
    options: ["2", "3", "4", "5"],
    correctIndex: 2,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What is the smallest bone in the human body?",
    options: ["Stapes", "Incus", "Malleus", "Patella"],
    correctIndex: 0,
    category: "Science",
    difficulty: "hard"
  },
  {
    question: "What is the most common element in the universe?",
    options: ["Oxygen", "Carbon", "Hydrogen", "Helium"],
    correctIndex: 2,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What causes tides on Earth?",
    options: ["The Sun", "The Moon", "Wind", "Earth's rotation"],
    correctIndex: 1,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "How many chambers does a human heart have?",
    options: ["2", "3", "4", "5"],
    correctIndex: 2,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What is the boiling point of water at sea level?",
    options: ["90°C", "100°C", "110°C", "212°C"],
    correctIndex: 1,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What is the largest moon of Saturn?",
    options: ["Europa", "Titan", "Ganymede", "Callisto"],
    correctIndex: 1,
    category: "Science",
    difficulty: "hard"
  },
  {
    question: "What is the pH of pure water?",
    options: ["5", "6", "7", "8"],
    correctIndex: 2,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What element has the atomic number 1?",
    options: ["Helium", "Hydrogen", "Lithium", "Oxygen"],
    correctIndex: 1,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What is the fastest land animal?",
    options: ["Lion", "Cheetah", "Gazelle", "Leopard"],
    correctIndex: 1,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What is the largest planet in our solar system?",
    options: ["Saturn", "Jupiter", "Neptune", "Uranus"],
    correctIndex: 1,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What is the study of insects called?",
    options: ["Entomology", "Arachnology", "Herpetology", "Ornithology"],
    correctIndex: 0,
    category: "Science",
    difficulty: "hard"
  },

  // More History
  {
    question: "Who was the first woman to win a Nobel Prize?",
    options: ["Marie Curie", "Mother Teresa", "Jane Addams", "Malala Yousafzai"],
    correctIndex: 0,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "What year did the Cold War end?",
    options: ["1989", "1990", "1991", "1992"],
    correctIndex: 2,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "Who was the youngest US President?",
    options: ["JFK", "Theodore Roosevelt", "Bill Clinton", "Barack Obama"],
    correctIndex: 1,
    category: "History",
    difficulty: "hard"
  },
  {
    question: "What year did India gain independence?",
    options: ["1945", "1947", "1949", "1950"],
    correctIndex: 1,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "Who invented the telephone?",
    options: ["Thomas Edison", "Nikola Tesla", "Alexander Graham Bell", "Samuel Morse"],
    correctIndex: 2,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "What was the name of the first atomic bomb test?",
    options: ["Manhattan", "Trinity", "Fatman", "Little Boy"],
    correctIndex: 1,
    category: "History",
    difficulty: "hard"
  },
  {
    question: "Who was the longest-reigning British monarch?",
    options: ["Queen Victoria", "Queen Elizabeth I", "Queen Elizabeth II", "King George III"],
    correctIndex: 2,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "What year did the American Civil War begin?",
    options: ["1859", "1861", "1863", "1865"],
    correctIndex: 1,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "Who built the Great Wall of China?",
    options: ["Ming Dynasty", "Qin Dynasty", "Han Dynasty", "Tang Dynasty"],
    correctIndex: 1,
    category: "History",
    difficulty: "hard"
  },
  {
    question: "What year was the internet invented?",
    options: ["1969", "1979", "1989", "1999"],
    correctIndex: 0,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "Who discovered penicillin?",
    options: ["Louis Pasteur", "Alexander Fleming", "Jonas Salk", "Marie Curie"],
    correctIndex: 1,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "What was the first country to give women the right to vote?",
    options: ["USA", "UK", "New Zealand", "Australia"],
    correctIndex: 2,
    category: "History",
    difficulty: "hard"
  },
  {
    question: "Who was the first person in space?",
    options: ["Neil Armstrong", "Buzz Aldrin", "Yuri Gagarin", "Alan Shepard"],
    correctIndex: 2,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "What year did the French Revolution begin?",
    options: ["1789", "1799", "1809", "1819"],
    correctIndex: 0,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "Who wrote 'The Art of War'?",
    options: ["Confucius", "Sun Tzu", "Lao Tzu", "Miyamoto Musashi"],
    correctIndex: 1,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "What was the name of the ship Charles Darwin sailed on?",
    options: ["HMS Victory", "HMS Beagle", "HMS Endeavour", "HMS Bounty"],
    correctIndex: 1,
    category: "History",
    difficulty: "hard"
  },
  {
    question: "Who was the first Emperor of Rome?",
    options: ["Julius Caesar", "Augustus", "Nero", "Tiberius"],
    correctIndex: 1,
    category: "History",
    difficulty: "hard"
  },
  {
    question: "What year did World War I begin?",
    options: ["1912", "1914", "1916", "1918"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "Who invented the printing press?",
    options: ["Leonardo da Vinci", "Johannes Gutenberg", "Benjamin Franklin", "Thomas Edison"],
    correctIndex: 1,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "What was the Black Death?",
    options: ["War", "Plague", "Famine", "Volcano"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "Who was known as the 'Maid of Orleans'?",
    options: ["Marie Antoinette", "Joan of Arc", "Catherine the Great", "Anne Boleyn"],
    correctIndex: 1,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "What year did the Renaissance begin?",
    options: ["1200s", "1300s", "1400s", "1500s"],
    correctIndex: 1,
    category: "History",
    difficulty: "hard"
  },
  {
    question: "Who wrote 'The Communist Manifesto'?",
    options: ["Lenin", "Stalin", "Marx and Engels", "Trotsky"],
    correctIndex: 2,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "What was the capital of the Byzantine Empire?",
    options: ["Rome", "Athens", "Constantinople", "Alexandria"],
    correctIndex: 2,
    category: "History",
    difficulty: "hard"
  },
  {
    question: "Who was the first female Prime Minister of the UK?",
    options: ["Margaret Thatcher", "Theresa May", "Queen Victoria", "Queen Elizabeth II"],
    correctIndex: 0,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "What year did the Chernobyl disaster occur?",
    options: ["1984", "1985", "1986", "1987"],
    correctIndex: 2,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "Who was the first person to circumnavigate the globe?",
    options: ["Christopher Columbus", "Ferdinand Magellan", "Vasco da Gama", "James Cook"],
    correctIndex: 1,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "What ancient city was destroyed by a volcano?",
    options: ["Rome", "Athens", "Pompeii", "Carthage"],
    correctIndex: 2,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "Who was the last Tsar of Russia?",
    options: ["Nicholas I", "Alexander II", "Nicholas II", "Peter the Great"],
    correctIndex: 2,
    category: "History",
    difficulty: "hard"
  },
  {
    question: "What year did the Great Depression begin?",
    options: ["1927", "1929", "1931", "1933"],
    correctIndex: 1,
    category: "History",
    difficulty: "medium"
  },

  // More Geography
  {
    question: "What is the capital of Canada?",
    options: ["Toronto", "Vancouver", "Ottawa", "Montreal"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "Which country has the most islands?",
    options: ["Indonesia", "Philippines", "Sweden", "Norway"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "hard"
  },
  {
    question: "What is the smallest continent?",
    options: ["Europe", "Antarctica", "Australia", "South America"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "Which river is the longest in Europe?",
    options: ["Danube", "Rhine", "Volga", "Thames"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "hard"
  },
  {
    question: "What is the capital of Brazil?",
    options: ["Rio de Janeiro", "São Paulo", "Brasília", "Salvador"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "Which country has the longest coastline?",
    options: ["Australia", "Russia", "Canada", "Indonesia"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "hard"
  },
  {
    question: "What is the largest lake in the world?",
    options: ["Lake Superior", "Caspian Sea", "Lake Victoria", "Lake Baikal"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "Which country is the largest in South America?",
    options: ["Argentina", "Brazil", "Colombia", "Peru"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "What is the highest mountain in Africa?",
    options: ["Mount Kenya", "Mount Kilimanjaro", "Mount Elgon", "Mount Meru"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "Which country has the most time zones?",
    options: ["USA", "Russia", "France", "China"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "hard"
  },
  {
    question: "What is the capital of New Zealand?",
    options: ["Auckland", "Wellington", "Christchurch", "Hamilton"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "Which desert is the largest hot desert?",
    options: ["Arabian", "Sahara", "Kalahari", "Gobi"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "What is the capital of Thailand?",
    options: ["Bangkok", "Phuket", "Chiang Mai", "Pattaya"],
    correctIndex: 0,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "Which country is both in Europe and Asia?",
    options: ["Russia", "Turkey", "Egypt", "Both A and B"],
    correctIndex: 3,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "What is the most populous city in the world?",
    options: ["Shanghai", "Tokyo", "Delhi", "São Paulo"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "Which ocean is the smallest?",
    options: ["Indian", "Arctic", "Southern", "Atlantic"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "What is the capital of Egypt?",
    options: ["Alexandria", "Cairo", "Giza", "Luxor"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "Which country has the most volcanoes?",
    options: ["Japan", "Indonesia", "USA", "Chile"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "hard"
  },
  {
    question: "What is the deepest point in the ocean?",
    options: ["Mariana Trench", "Puerto Rico Trench", "Java Trench", "Philippine Trench"],
    correctIndex: 0,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "Which country has no capital city?",
    options: ["Monaco", "Vatican City", "Nauru", "Tuvalu"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "hard"
  },
  {
    question: "What is the capital of South Korea?",
    options: ["Busan", "Seoul", "Incheon", "Daegu"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "Which sea is the saltiest?",
    options: ["Dead Sea", "Red Sea", "Black Sea", "Caspian Sea"],
    correctIndex: 0,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "What is the largest island in the Mediterranean?",
    options: ["Crete", "Cyprus", "Sicily", "Sardinia"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "hard"
  },
  {
    question: "Which country is the Eiffel Tower in?",
    options: ["Italy", "Spain", "France", "Belgium"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "What is the longest mountain range?",
    options: ["Rockies", "Andes", "Himalayas", "Alps"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "Which country has the most UNESCO World Heritage Sites?",
    options: ["France", "China", "Italy", "Spain"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "hard"
  },
  {
    question: "What is the capital of Argentina?",
    options: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza"],
    correctIndex: 0,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "Which country has the most pyramids?",
    options: ["Egypt", "Mexico", "Sudan", "Peru"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "hard"
  },
  {
    question: "What is the official language of Brazil?",
    options: ["Spanish", "Portuguese", "English", "French"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "Which country is home to the Great Barrier Reef?",
    options: ["Indonesia", "Philippines", "Australia", "New Zealand"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "What is the capital of Switzerland?",
    options: ["Zurich", "Geneva", "Bern", "Basel"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "hard"
  },

  // More Random/Fun
  {
    question: "How many legs does a spider have?",
    options: ["6", "8", "10", "12"],
    correctIndex: 1,
    category: "Random",
    difficulty: "easy"
  },
  {
    question: "What is the tallest building in the world?",
    options: ["Burj Khalifa", "Shanghai Tower", "One World Trade Center", "CN Tower"],
    correctIndex: 0,
    category: "Random",
    difficulty: "medium"
  },
  {
    question: "How many days are in a leap year?",
    options: ["364", "365", "366", "367"],
    correctIndex: 2,
    category: "Random",
    difficulty: "easy"
  },
  {
    question: "What is the currency of Japan?",
    options: ["Yuan", "Won", "Yen", "Rupee"],
    correctIndex: 2,
    category: "Random",
    difficulty: "easy"
  },
  {
    question: "How many strings does a standard guitar have?",
    options: ["4", "5", "6", "7"],
    correctIndex: 2,
    category: "Random",
    difficulty: "easy"
  },
  {
    question: "What is the smallest country by area?",
    options: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"],
    correctIndex: 1,
    category: "Random",
    difficulty: "medium"
  },
  {
    question: "How many players are on a baseball team?",
    options: ["7", "8", "9", "10"],
    correctIndex: 2,
    category: "Random",
    difficulty: "easy"
  },
  {
    question: "What color is a giraffe's tongue?",
    options: ["Pink", "Red", "Blue", "Purple"],
    correctIndex: 3,
    category: "Random",
    difficulty: "hard"
  },
  {
    question: "How many holes are on a standard golf course?",
    options: ["9", "12", "18", "27"],
    correctIndex: 2,
    category: "Random",
    difficulty: "easy"
  },
  {
    question: "What is the largest ocean animal?",
    options: ["Shark", "Blue Whale", "Kraken", "Giant Squid"],
    correctIndex: 1,
    category: "Random",
    difficulty: "easy"
  },
  {
    question: "How many keys are on a standard piano?",
    options: ["76", "82", "88", "96"],
    correctIndex: 2,
    category: "Random",
    difficulty: "medium"
  },
  {
    question: "What fruit has seeds on the outside?",
    options: ["Raspberry", "Strawberry", "Blackberry", "Blueberry"],
    correctIndex: 1,
    category: "Random",
    difficulty: "easy"
  },
  {
    question: "How many seconds are in an hour?",
    options: ["3,000", "3,600", "6,000", "7,200"],
    correctIndex: 1,
    category: "Random",
    difficulty: "easy"
  },
  {
    question: "What is the fastest bird in the world?",
    options: ["Eagle", "Falcon", "Hawk", "Peregrine Falcon"],
    correctIndex: 3,
    category: "Random",
    difficulty: "medium"
  },
  {
    question: "How many rings are on the Olympic flag?",
    options: ["4", "5", "6", "7"],
    correctIndex: 1,
    category: "Random",
    difficulty: "easy"
  },
  {
    question: "What is the hottest chili pepper?",
    options: ["Habanero", "Ghost Pepper", "Carolina Reaper", "Jalapeño"],
    correctIndex: 2,
    category: "Random",
    difficulty: "hard"
  },
  {
    question: "How many dots are on a pair of dice?",
    options: ["21", "36", "42", "48"],
    correctIndex: 2,
    category: "Random",
    difficulty: "medium"
  },
  {
    question: "What is the longest bone in the human body?",
    options: ["Tibia", "Fibula", "Femur", "Humerus"],
    correctIndex: 2,
    category: "Random",
    difficulty: "medium"
  },
  {
    question: "How many cards are in a standard deck?",
    options: ["48", "50", "52", "54"],
    correctIndex: 2,
    category: "Random",
    difficulty: "easy"
  },
  {
    question: "What animal can't jump?",
    options: ["Elephant", "Hippo", "Rhino", "All of the above"],
    correctIndex: 0,
    category: "Random",
    difficulty: "medium"
  },
  {
    question: "How many players are on a basketball team on the court?",
    options: ["4", "5", "6", "7"],
    correctIndex: 1,
    category: "Random",
    difficulty: "easy"
  },
  {
    question: "What is the rarest M&M color?",
    options: ["Brown", "Blue", "Red", "Green"],
    correctIndex: 0,
    category: "Random",
    difficulty: "hard"
  },
  {
    question: "How many time zones does Russia have?",
    options: ["7", "9", "11", "13"],
    correctIndex: 2,
    category: "Random",
    difficulty: "hard"
  },
  {
    question: "What animal sleeps the most?",
    options: ["Cat", "Sloth", "Koala", "Brown Bat"],
    correctIndex: 3,
    category: "Random",
    difficulty: "hard"
  },
  {
    question: "How many teeth do adult dogs have?",
    options: ["32", "36", "42", "48"],
    correctIndex: 2,
    category: "Random",
    difficulty: "hard"
  },
  {
    question: "What is the most spoken language in the world?",
    options: ["English", "Spanish", "Mandarin Chinese", "Hindi"],
    correctIndex: 2,
    category: "Random",
    difficulty: "medium"
  },
  {
    question: "How many players are on a soccer team?",
    options: ["9", "10", "11", "12"],
    correctIndex: 2,
    category: "Random",
    difficulty: "easy"
  },
  {
    question: "What is the most common eye color?",
    options: ["Blue", "Green", "Brown", "Hazel"],
    correctIndex: 2,
    category: "Random",
    difficulty: "easy"
  },
  {
    question: "How many wives did Henry VIII have?",
    options: ["4", "5", "6", "7"],
    correctIndex: 2,
    category: "Random",
    difficulty: "medium"
  },
  {
    question: "What animal has the highest blood pressure?",
    options: ["Elephant", "Giraffe", "Blue Whale", "Rhino"],
    correctIndex: 1,
    category: "Random",
    difficulty: "hard"
  },

  // Additional Gaming
  {
    question: "In Clash of Clans, what is the max Town Hall level?",
    options: ["13", "15", "16", "17"],
    correctIndex: 2,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "What is the max level in World of Warcraft?",
    options: ["60", "70", "80", "90"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "In Pac-Man, what are the ghosts' names?",
    options: ["Inky, Blinky, Pinky, Clyde", "Red, Blue, Pink, Orange", "Bob, Rob, Job, Mob", "Speedy, Pokey, Bashful, Shadow"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "hard"
  },
  {
    question: "What is the best-selling console of all time?",
    options: ["PS2", "Nintendo DS", "PS4", "Xbox 360"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "In Fall Guys, how many players start each match?",
    options: ["40", "50", "60", "100"],
    correctIndex: 2,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "What company makes the Xbox?",
    options: ["Sony", "Nintendo", "Microsoft", "Sega"],
    correctIndex: 2,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "In Super Mario, what is Bowser's son called?",
    options: ["Bowser Jr.", "Baby Bowser", "Bowser II", "Mini Bowser"],
    correctIndex: 0,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "What is the currency in World of Warcraft?",
    options: ["Coins", "Gold", "Dollars", "Credits"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "In Rust, what do you start with?",
    options: ["Gun", "Rock", "Axe", "Nothing"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "medium"
  },
  {
    question: "What game has the largest open world?",
    options: ["GTA V", "Minecraft", "No Man's Sky", "Skyrim"],
    correctIndex: 2,
    category: "Gaming",
    difficulty: "hard"
  },

  // Additional Movies/TV
  {
    question: "What is the highest-rated movie on IMDb?",
    options: ["Godfather", "Shawshank Redemption", "Dark Knight", "Pulp Fiction"],
    correctIndex: 1,
    category: "Movies",
    difficulty: "medium"
  },
  {
    question: "In Prison Break, what is Michael Scofield's profession?",
    options: ["Lawyer", "Engineer", "Doctor", "Architect"],
    correctIndex: 1,
    category: "TV",
    difficulty: "medium"
  },
  {
    question: "What is the longest-running animated TV show?",
    options: ["Family Guy", "South Park", "The Simpsons", "SpongeBob"],
    correctIndex: 2,
    category: "TV",
    difficulty: "easy"
  },
  {
    question: "Who played Spider-Man in the 2002 movie?",
    options: ["Andrew Garfield", "Tom Holland", "Tobey Maguire", "Jake Gyllenhaal"],
    correctIndex: 2,
    category: "Movies",
    difficulty: "easy"
  },
  {
    question: "In The Walking Dead, what is Rick's profession?",
    options: ["Doctor", "Sheriff", "Teacher", "Soldier"],
    correctIndex: 1,
    category: "TV",
    difficulty: "easy"
  },
  {
    question: "What year was Netflix founded?",
    options: ["1995", "1997", "1999", "2001"],
    correctIndex: 1,
    category: "TV",
    difficulty: "hard"
  },
  {
    question: "In Seinfeld, what is Kramer's first name?",
    options: ["Bob", "Cosmo", "Larry", "Newman"],
    correctIndex: 1,
    category: "TV",
    difficulty: "hard"
  },
  {
    question: "What is the highest-grossing animated movie?",
    options: ["Frozen", "Lion King (2019)", "Frozen II", "Incredibles 2"],
    correctIndex: 1,
    category: "Movies",
    difficulty: "hard"
  },
  {
    question: "In House, what is Dr. House's specialty?",
    options: ["Cardiology", "Neurology", "Diagnostic Medicine", "Surgery"],
    correctIndex: 2,
    category: "TV",
    difficulty: "medium"
  },
  {
    question: "What is the first Pixar movie?",
    options: ["Finding Nemo", "Toy Story", "Monsters Inc", "A Bug's Life"],
    correctIndex: 1,
    category: "Movies",
    difficulty: "easy"
  },
  {
    question: "In How I Met Your Mother, what is Barney's catchphrase?",
    options: ["Legendary", "Suit up", "True story", "All of the above"],
    correctIndex: 3,
    category: "TV",
    difficulty: "easy"
  },

  // Final 10 Questions
  {
    question: "What is the smallest prime number?",
    options: ["0", "1", "2", "3"],
    correctIndex: 2,
    category: "Random",
    difficulty: "medium"
  },
  {
    question: "How many continents start with the letter 'A'?",
    options: ["2", "3", "4", "5"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "hard"
  },
  {
    question: "What is the name of the longest river in Asia?",
    options: ["Mekong", "Ganges", "Yangtze", "Yellow River"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "In Among Us, what is the impostor's goal?",
    options: ["Complete tasks", "Sabotage and eliminate crew", "Fix the ship", "Call meetings"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "What Netflix show features a chess prodigy?",
    options: ["The Crown", "The Queen's Gambit", "Bridgerton", "Ozark"],
    correctIndex: 1,
    category: "TV",
    difficulty: "easy"
  },
  {
    question: "What is the national animal of Scotland?",
    options: ["Lion", "Eagle", "Unicorn", "Dragon"],
    correctIndex: 2,
    category: "Random",
    difficulty: "hard"
  },
  {
    question: "How many elements are in the periodic table?",
    options: ["98", "108", "118", "128"],
    correctIndex: 2,
    category: "Science",
    difficulty: "hard"
  },
  {
    question: "What is the most-watched YouTube video?",
    options: ["Despacito", "Baby Shark", "Gangnam Style", "See You Again"],
    correctIndex: 1,
    category: "Random",
    difficulty: "medium"
  },
  {
    question: "In Valorant, how many agents can you have per team?",
    options: ["4", "5", "6", "7"],
    correctIndex: 1,
    category: "Gaming",
    difficulty: "easy"
  },
  {
    question: "What is the square root of 144?",
    options: ["10", "11", "12", "13"],
    correctIndex: 2,
    category: "Random",
    difficulty: "easy"
  }
];

/**
 * Get a random question from the pool
 */
function getRandomQuestion(excludeIds = []) {
  const availableQuestions = TRIVIA_QUESTIONS.filter((_, index) => !excludeIds.includes(index));

  if (availableQuestions.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * availableQuestions.length);
  const question = availableQuestions[randomIndex];
  const originalIndex = TRIVIA_QUESTIONS.indexOf(question);

  return {
    ...question,
    id: originalIndex
  };
}

/**
 * Get multiple random questions for a session
 */
function getRandomQuestions(count = 10) {
  const questions = [];
  const usedIds = [];

  for (let i = 0; i < count && i < TRIVIA_QUESTIONS.length; i++) {
    const question = getRandomQuestion(usedIds);
    if (question) {
      questions.push(question);
      usedIds.push(question.id);
    }
  }

  return questions;
}

module.exports = {
  TRIVIA_QUESTIONS,
  getRandomQuestion,
  getRandomQuestions
};