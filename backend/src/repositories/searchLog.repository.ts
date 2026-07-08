/**
 * Search log repository. Persistence + aggregations for search analytics.
 */
import { SearchLogModel, type ISearchLog, type SearchLogDoc } from '../models/searchLog.model.js';

export interface TopTopic {
  query: string;
  count: number;
}

export interface QueriedDocument {
  documentId: string;
  title: string;
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

  /** Documents most frequently used to ground answers. */
  async mostQueriedDocuments(limit = 5): Promise<QueriedDocument[]> {
    const rows = await SearchLogModel.aggregate<{ _id: string; title: string; count: number }>([
      { $unwind: '$sources' },
      {
        $group: {
          _id: '$sources.documentId',
          title: { $first: '$sources.title' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]).exec();
    return rows.map((r) => ({ documentId: r._id, title: r.title, count: r.count }));
  }
}

export const searchLogRepository = new SearchLogRepository();
