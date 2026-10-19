/// <reference types="vite/client" />

/** Build identifier, compared with /version.json to detect a newer deploy. */
declare const __APP_BUILD_ID__: string;
/** Content hash of public/words.txt.gz, appended to the dictionary URL. */
declare const __DICTIONARY_VERSION__: string;
