import { config } from '../config';
import type { RepoInsight } from '../types';

export async function getRepoInsight(): Promise<RepoInsight> {
  const { owner, repo, token } = config.github;
  if (!owner || !repo || !token) {
    return {
      status: 'missing-config',
      summary: 'GitHub repo intelligence is configured in code but missing credentials or repo metadata.',
      commits: []
    };
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=5`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'sawa-agent'
    }
  });

  if (!response.ok) {
    return {
      status: 'missing-config',
      summary: `GitHub API call failed with status ${response.status}.`,
      commits: []
    };
  }

  const data = (await response.json()) as Array<{ commit: { message: string } }>;
  const commits = data.map((entry) => entry.commit.message.split('\n')[0]);
  return {
    status: 'available',
    summary: commits.length ? `Latest repo activity: ${commits[0]}` : 'No recent commits found.',
    commits
  };
}
