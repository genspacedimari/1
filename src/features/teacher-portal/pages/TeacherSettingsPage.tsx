import { useEffect, useState } from 'react';
import { Plus, Trash2, Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useTeacherStore } from '../store';
import { DEFAULT_CATEGORIES } from '../types';

export function TeacherSettingsPage() {
  const { categories, loadCategories, createCategory, deleteCategory } = useTeacherStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createCategory(newName.trim());
    setNewName('');
    setShowCreate(false);
  };

  const handleCreateDefaults = async () => {
    for (const name of DEFAULT_CATEGORIES) {
      const exists = categories.some((c) => c.name === name);
      if (!exists) await createCategory(name);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Manage your question categories.</p>
      </div>

      {/* Categories */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-semibold">Question Categories</h2>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1 text-sm font-medium text-primary"
            >
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="border-t border-border dark:border-border-dark" />

          {showCreate && (
            <div className="flex items-center gap-2 px-5 py-3">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Category name"
                className="flex-1 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                style={{ minHeight: 44 }}
              />
              <Button onClick={handleCreate} size="sm">Add</Button>
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          )}

          {categories.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <Tag size={28} className="mx-auto text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No categories yet.</p>
              <Button variant="outline" className="mt-3" onClick={handleCreateDefaults}>
                Create Default Categories
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border dark:divide-border-dark">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm font-medium">{cat.name}</span>
                  </div>
                  <button
                    onClick={() => setConfirmDelete(cat.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Category"
        message="Questions in this category will lose their category association but will not be deleted."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { if (confirmDelete) deleteCategory(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
