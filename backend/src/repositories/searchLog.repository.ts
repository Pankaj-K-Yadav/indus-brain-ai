/**
 * Search log repository. Persistence + aggregations for search analytics.
 */
import { SearchLogModel, type ISearchLog, type SearchLogDoc } from '../models/searchLog.model.js';

export interface TopTopic {
  query: string;
  count: number;
}

class SearchLogRepository {
  create(data: ISearchLog): Promise<SearchLogDoc> {
    return SearchLogModel.create(data);
  }

  count(): Promise<number> {
    return SearchLogModel.countDocuments().exec();
  }

  /** Most frequent normalized queries. */
  async topTopics(limit = 5): Promise<TopTopic[]> {
    const rows = await SearchLogModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: { $toLower: '$query' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]).exec();
    return rows.map((r) => ({ query: r._id, count: r.count }));
  }
}

export const searchLogRepository = new SearchLogRepository();
