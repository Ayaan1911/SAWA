import type { ResearchDigest } from '../types';

export async function getResearchDigest(query = 'autonomous agent productivity'): Promise<ResearchDigest> {
  const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=3&sortBy=lastUpdatedDate&sortOrder=descending`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        status: 'missing-config',
        summary: `arXiv request failed with status ${response.status}.`,
        papers: []
      };
    }

    const xml = await response.text();
    const papers = [...xml.matchAll(/<entry>[\s\S]*?<title>([\s\S]*?)<\/title>/g)]
      .slice(0, 3)
      .map((match) => match[1].replace(/\s+/g, ' ').trim())
      .filter((title) => title.toLowerCase() !== 'arxiv query results');

    return {
      status: 'available',
      summary: papers.length ? `Top paper: ${papers[0]}` : 'No papers returned for the configured query.',
      papers
    };
  } catch (error) {
    return {
      status: 'missing-config',
      summary: `arXiv request failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
      papers: []
    };
  }
}
