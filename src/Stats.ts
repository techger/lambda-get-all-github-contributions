import {
  Commit,
  Dict,
  GraphStats,
  Repository,
  StatsKey,
  StatsPosition,
  Totals,
  TimeStats,
  WeekDayStats,
} from './types';
import Storage from './Storage';
import Crawler from './Crawler';

export class Stats implements StatsPosition {
  crawler: Crawler;
  storage: Storage;
  stats: GraphStats = {
    quarterly: {},
    hourly: {},
    daily: {},
    weekly: {},
    monthly: {},
    yearly: {},
    weekDays: {},
    repositories: {},
  };
  repositoryMapping: Dict<string> = {};
  nextPrivateId: number = 1;
  processedCommits: Dict<string> = {};
  lastData?: string;
  hasChanged: boolean = false;

  constructor(crawler: Crawler, storage: Storage) {
    this.crawler = crawler;
    this.storage = storage;
  }

  get positionId() {
    return `${ this.crawler.userId }-stats`;
  }

  get statsId() {
    return this.crawler.userLogin;
  }

  static get emptyTotals(): Totals {
    return {
      additions: 0,
      deletions: 0,
      changedFiles: 0,
      commitCount: 0,
    };
  }

  static get emptyWeekDayStats(): WeekDayStats {
    return {
      additions: 0,
      deletions: 0,
      changedFiles: 0,
      commitCount: 0,
      hours: {},
    };
  }

  static async create(crawler: Crawler): Promise<Stats> {
    const storage = await Storage.create();
    const stats = new Stats(crawler, storage);
    await stats.restore();
    await stats.init();
    return stats;
  }

  async initRepositoryMapping() {
    for (const repoKey in this.crawler.repositories) {
      if (!this.repositoryMapping[repoKey]) {
        const repo = this.crawler.repositories[repoKey];
        if (repo.isPrivate) {
          const privateKey = `${ repo.owner }/private#${ this.nextPrivateId }`;
          this.nextPrivateId += 1;
          this.repositoryMapping[repoKey] = privateKey;
          this.repositoryMapping[privateKey] = repoKey;
        } else {
          this.repositoryMapping[repoKey] = repoKey;
        }
      }
    }
  }

  async init() {
    await this.initRepositoryMapping();
    await this.save();
  }

  get position(): StatsPosition {
    return {
      stats: this.stats,
      repositoryMapping: this.repositoryMapping,
      nextPrivateId: this.nextPrivateId,
      processedCommits: this.processedCommits,
    };
  }

  async save() {
    const dataStr = JSON.stringify(this.position);
    const hasChanged = this.lastData !== dataStr;
    if (hasChanged) {
      this.lastData = dataStr;
      await this.storage.writeItem(this.positionId, dataStr);
      await this.storage.writeItem(this.statsId, JSON.stringify(this.stats));
    } else {
      console.log('skipped writing - no changes detected');
    }
    this.hasChanged = this.hasChanged || hasChanged;
    return hasChanged;
  }

  async restore() {
    const dataStr = await this.storage.readItem(this.positionId);
    if (dataStr) {
      const data: StatsPosition = JSON.parse(dataStr);
      this.lastData = dataStr;
      this.stats = data.stats;
      this.repositoryMapping = data.repositoryMapping;
      this.nextPrivateId = data.nextPrivateId;
      this.processedCommits = data.processedCommits;
    }
  }
}

export default Stats;
