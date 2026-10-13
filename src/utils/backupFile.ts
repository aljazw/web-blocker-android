import { NativeModules } from 'react-native';

const { BackupFile } = NativeModules;

/** Lets the user pick where to save `content`. Resolves false if they cancel. */
export const saveBackupFile = (fileName: string, content: string): Promise<boolean> =>
    BackupFile.save(fileName, content);

/** Lets the user pick a backup file and returns its text, or null if they cancel. */
export const openBackupFile = (): Promise<string | null> => BackupFile.open();
