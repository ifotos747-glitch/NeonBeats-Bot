'use strict';
const {SlashCommandBuilder}=require('discord.js');
const source=o=>o.setName('source').setDescription('Plik music/, stacja lub publiczne źródło audio').setRequired(true);
const named=o=>o.setName('nazwa').setDescription('Nazwa playlisty lub stacji').setRequired(true);
const commands=[
 new SlashCommandBuilder().setName('neonhelp').setDescription('Pomoc NeonBeats Bot'),
 new SlashCommandBuilder().setName('status').setDescription('Status i diagnostyka audio'),
 new SlashCommandBuilder().setName('play').setDescription('Dodaj plik lub strumień do kolejki').addStringOption(source),
 new SlashCommandBuilder().setName('queue').setDescription('Pokaż kolejkę'),
 new SlashCommandBuilder().setName('nowplaying').setDescription('Aktualny utwór'),
 new SlashCommandBuilder().setName('pause').setDescription('Pauza'),
 new SlashCommandBuilder().setName('resume').setDescription('Wznów muzykę'),
 new SlashCommandBuilder().setName('skip').setDescription('Pomiń utwór'),
 new SlashCommandBuilder().setName('stop').setDescription('Zatrzymaj muzykę i kolejkę'),
 new SlashCommandBuilder().setName('leave').setDescription('Wyjdź z kanału głosowego'),
 new SlashCommandBuilder().setName('volume').setDescription('Ustaw głośność (0–150%)')
   .addIntegerOption(o=>o.setName('procent').setDescription('Głośność').setRequired(true).setMinValue(0).setMaxValue(150)),
 new SlashCommandBuilder().setName('panel').setDescription('Panel sterowania NeonBeats'),
 new SlashCommandBuilder().setName('files').setDescription('Pokaż pliki w music/'),
 new SlashCommandBuilder().setName('testaudio').setDescription('Odtwórz własny testowy dźwięk'),
 new SlashCommandBuilder().setName('youtube').setDescription('YouTube: silnik, instalacja i diagnostyka')
   .addSubcommand(s=>s.setName('status').setDescription('Sprawdź silnik yt-dlp'))
   .addSubcommand(s=>s.setName('install').setDescription('Zainstaluj oficjalne yt-dlp (administrator)'))
   .addSubcommand(s=>s.setName('playlista').setDescription('Dodaj filmy z playlisty YouTube do kolejki')
     .addStringOption(o=>o.setName('url').setDescription('Link do playlisty YouTube').setRequired(true))
     .addIntegerOption(o=>o.setName('od').setDescription('Od której pozycji playlisty (domyślnie 1)').setMinValue(1).setMaxValue(10000))
     .addIntegerOption(o=>o.setName('ile').setDescription('Ile pozycji pobrać, maksymalnie 100').setMinValue(1).setMaxValue(100)))
   .addSubcommand(s=>s.setName('diagnoza').setDescription('Sprawdź dostęp do filmu YouTube')
     .addStringOption(o=>o.setName('url').setDescription('Link YouTube').setRequired(true))),
 new SlashCommandBuilder().setName('radio').setDescription('Stacje radiowe')
   .addSubcommand(s=>s.setName('list').setDescription('Pokaż globalne stacje'))
   .addSubcommand(s=>s.setName('szukaj').setDescription('Wyszukaj stację i wybierz z menu').addStringOption(o=>o.setName('nazwa').setDescription('Fragment nazwy').setRequired(false)))
   .addSubcommand(s=>s.setName('ulubione').setDescription('Ulubione stacje serwera'))
   .addSubcommand(s=>s.setName('ulubione-dodaj').setDescription('Dodaj ulubioną stację').addStringOption(named))
   .addSubcommand(s=>s.setName('ulubione-usun').setDescription('Usuń ulubioną stację').addStringOption(named))
   .addSubcommandGroup(g=>g.setName('admin').setDescription('Globalna administracja')
     .addSubcommand(s=>s.setName('dodaj').setDescription('Dodaj globalną stację').addStringOption(named).addStringOption(o=>o.setName('url').setDescription('Adres audio').setRequired(true)))
     .addSubcommand(s=>s.setName('edytuj').setDescription('Edytuj stację').addStringOption(named).addStringOption(o=>o.setName('nowa-nazwa').setDescription('Nowa nazwa')).addStringOption(o=>o.setName('url').setDescription('Nowy adres')))
     .addSubcommand(s=>s.setName('usun').setDescription('Usuń globalną stację').addStringOption(named)))
   .addSubcommand(s=>s.setName('play').setDescription('Odtwórz stację').addStringOption(named))
   .addSubcommand(s=>s.setName('stop').setDescription('Zatrzymaj radio'))
   .addSubcommand(s=>s.setName('add').setDescription('Dodaj dozwolony strumień')
     .addStringOption(named)
     .addStringOption(o=>o.setName('url').setDescription('Publiczny URL audio').setRequired(true)))
   .addSubcommand(s=>s.setName('remove').setDescription('Usuń stację').addStringOption(named))
   .addSubcommand(s=>s.setName('diagnoza').setDescription('Sprawdź audio i błąd FFmpeg zapisanej stacji').addStringOption(named)),
 new SlashCommandBuilder().setName('autodj').setDescription('Odtwarzanie plików music/')
   .addSubcommand(s=>s.setName('on').setDescription('Włącz AutoDJ'))
   .addSubcommand(s=>s.setName('off').setDescription('Wyłącz AutoDJ')),
 new SlashCommandBuilder().setName('247').setDescription('Tryb ciągłego działania')
   .addSubcommand(s=>s.setName('on').setDescription('Uruchom tryb 24/7')
     .addStringOption(o=>o.setName('tryb').setDescription('Tryb odtwarzania').setRequired(true).addChoices(
       {name:'radio',value:'radio'},{name:'autodj',value:'autodj'},{name:'silent',value:'silent'}))
     .addStringOption(o=>o.setName('stacja').setDescription('Nazwa radia dla trybu radio')))
   .addSubcommand(s=>s.setName('off').setDescription('Wyłącz 24/7'))
   .addSubcommand(s=>s.setName('status').setDescription('Status 24/7')),
 new SlashCommandBuilder().setName('dj').setDescription('Efekty DJ')
   .addSubcommand(s=>s.setName('preset').setDescription('Wybierz preset DJ')
     .addStringOption(o=>o.setName('efekt').setDescription('Efekt').setRequired(true).addChoices(
       {name:'Bass Boost',value:'bass'},{name:'Nightcore',value:'nightcore'},
       {name:'Slowed',value:'slowed'},{name:'8D',value:'8d'},
       {name:'Echo',value:'echo'},{name:'Club',value:'club'})))
   .addSubcommand(s=>s.setName('off').setDescription('Wyłącz DJ'))
   .addSubcommand(s=>s.setName('status').setDescription('Aktualny DJ')),
 new SlashCommandBuilder().setName('playlist').setDescription('Zapisane playlisty')
   .addSubcommand(s=>s.setName('save').setDescription('Zapisz kolejkę').addStringOption(named))
   .addSubcommand(s=>s.setName('load').setDescription('Wczytaj playlistę').addStringOption(named))
   .addSubcommand(s=>s.setName('list').setDescription('Pokaż playlisty'))
   .addSubcommand(s=>s.setName('delete').setDescription('Usuń playlistę').addStringOption(named))
];
module.exports={commands};
