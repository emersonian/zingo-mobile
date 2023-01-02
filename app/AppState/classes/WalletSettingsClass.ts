export default class WalletSettingsClass {
  download_memos: string;
  transaction_filter_threshold: string;
  server: string;
  language?: string;
  currency?: string;

  constructor() {
    this.download_memos = 'wallet';
    this.transaction_filter_threshold = '500';
    this.server = '';
  }
}