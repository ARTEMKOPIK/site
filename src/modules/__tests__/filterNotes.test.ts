import { describe, it, expect } from '@jest/globals';

type TagObj = { name: string; color: string };
type Note = {
  id: string;
  title: string;
  content: string;
  tags: TagObj[];
};

function filterNotes(notes: Note[], search: string, tagFilter: string | null) {
  let result = notes;
  if (tagFilter) {
    result = result.filter(n => n.tags.some(t => t.name === tagFilter));
  }
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some(t => t.name.toLowerCase().includes(q))
    );
  }
  return result;
}

describe('filterNotes', () => {
  const notes: Note[] = [
    { id: '1', title: 'React', content: 'Hooks and state', tags: [{ name: 'frontend', color: '#f59e42' }] },
    { id: '2', title: 'Node', content: 'Express server', tags: [{ name: 'backend', color: '#6366f1' }] },
    { id: '3', title: 'CSS', content: 'Flexbox', tags: [{ name: 'frontend', color: '#f59e42' }] },
  ];

  it('filters by tag', () => {
    const filtered = filterNotes(notes, '', 'frontend');
    expect(filtered).toHaveLength(2);
    expect(filtered[0].title).toBe('React');
    expect(filtered[1].title).toBe('CSS');
  });

  it('filters by search', () => {
    const filtered = filterNotes(notes, 'node', null);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Node');
  });

  it('filters by tag and search', () => {
    const filtered = filterNotes(notes, 'css', 'frontend');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('CSS');
  });
}); 