"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, writeBatch, getDocs, where } from "firebase/firestore";
import { Category, categorySchema } from "@/lib/schema";
import { accessConfig } from "@/lib/config";
import { Loader2, Plus, Edit2, Trash2, Check, X, GripVertical, Eye, EyeOff } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import clsx from "clsx"; 
export default function CategoryManager({ tenantId }: { tenantId: string }) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newCategory, setNewCategory] = useState({ name: "", order: 0 });
    const [editForm, setEditForm] = useState<Category | null>(null);

    useEffect(() => {
        if (!tenantId) return;

        const q = query(
            collection(db, "categories"),
            where("tenantId", "==", tenantId),
            orderBy("order", "asc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const cats = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Category[];
            setCategories(cats);
            setLoading(false);
        }, (error) => {
            console.error("Category listener error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [tenantId]);

    // 抽出共用的全局同步邏輯
    const syncPortfolioItems = async (updatedCats: Category[], oldName?: string, newName?: string) => {
        try {
            const batch = writeBatch(db);
            const portfolioRef = collection(db, "portfolio_items");
            const snapshot = await getDocs(query(
                portfolioRef,
                where("tenantId", "==", tenantId)
            ));

            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                const updates: any = {};

                const searchName = (oldName && data.categoryName === oldName) ? newName : data.categoryName;
                const matchedCat = updatedCats.find(c => c.name === searchName);

                if (matchedCat && data.categoryOrder !== matchedCat.order) {
                    updates.categoryOrder = matchedCat.order;
                }

                if (oldName && newName && data.categoryName === oldName) {
                    updates.categoryName = newName;
                }

                if (Object.keys(updates).length > 0) {
                    batch.update(docSnap.ref, updates);
                }
            });

            await batch.commit();
        } catch (error) {
            console.error("同步作品資料失敗:", error);
            throw error;
        }
    };

    const onDragEnd = async (result: DropResult) => {
        if (!result.destination) return;

        const items = Array.from(categories);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        setCategories(items);
        setLoading(true);
        try {
            const batch = writeBatch(db);
            items.forEach((item, index) => {
                if (item.id) {
                    const categoryRef = doc(db, "categories", item.id);
                    batch.update(categoryRef, { order: index });
                }
            });
            await batch.commit();
            await syncPortfolioItems(items);
        } catch (error) {
            console.error("順序自動同步失敗:", error);
            alert("順序同步失敗，請重新整理頁面。");
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const order = categories.length > 0 ? Math.max(...categories.map(c => c.order)) + 1 : 0;
            const categoryData = {
                ...newCategory,
                order,
                visible: true,
                tenantId: tenantId
            };

            categorySchema.parse(categoryData);
            await addDoc(collection(db, "categories"), categoryData);
            setNewCategory({ name: "", order: 0 });
        } catch (error) {
            alert("請填寫相本名稱");
        }
    };

    const handleUpdate = async (id: string) => {
        if (!editForm) return;
        const oldCat = categories.find(c => c.id === id);
        if (!oldCat) return;

        setLoading(true);
        try {
            const { id: _, ...data } = editForm;
            const isRenamed = oldCat.name !== data.name;
            await updateDoc(doc(db, "categories", id), data);
            if (isRenamed) {
                const updatedCats = categories.map(c => c.id === id ? editForm : c);
                await syncPortfolioItems(updatedCats, oldCat.name, data.name);
            }
            setEditingId(null);
        } catch (error) {
            alert("更新失敗");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("確定要刪除此相本嗎？這可能會影響相關作品的顯示。")) {
            await deleteDoc(doc(db, "categories", id));
        }
    };

    const handleToggleVisible = async (id: string, currentVisible: boolean) => {
        try {
            await updateDoc(doc(db, "categories", id), {
                visible: !currentVisible
            });
        } catch (error) {
            console.error("切換顯示狀態失敗:", error);
            alert("操作失敗,請稍後再試");
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-6 text-gray-800">相本管理</h2>

            <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 mb-8 items-stretch sm:items-end">
                <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">快速新增相本名稱</label>
                    <input
                        value={newCategory.name}
                        onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
                        className="w-full px-3 py-2.5 border rounded-lg text-sm bg-gray-50/30"
                        placeholder="例如：新娘美妝"
                    />
                </div>
                <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-[#1A1A1A] text-white p-2.5 rounded-lg hover:bg-gray-800 h-[42px] px-4 flex items-center justify-center gap-2 text-sm transition-colors">
                        <Plus size={18} /> 新增
                    </button>
                </div>
            </form>

            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="categories">
                    {(provided) => (
                        <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="space-y-2"
                        >
                            {categories.map((cat, index) => (
                                <Draggable key={cat.id} draggableId={cat.id!} index={index}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            className={clsx(
                                                "flex items-center gap-4 p-3 border rounded-lg group transition-all",
                                                snapshot.isDragging ? "bg-white shadow-xl border-gray-800 z-50 scale-[1.02]" : "bg-white hover:bg-gray-50 border-gray-100"
                                            )}
                                        >
                                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-1">
                                                <GripVertical size={18} className="text-gray-300 group-hover:text-gray-500" />
                                            </div>

                                            {editingId === cat.id ? (
                                                <div className="flex flex-1 gap-2">
                                                    <input
                                                        value={editForm?.name}
                                                        onChange={e => setEditForm(prev => prev ? { ...prev, name: e.target.value } : null)}
                                                        className="flex-1 px-2 py-1.5 border rounded text-sm outline-none focus:border-gray-800"
                                                        autoFocus
                                                    />
                                                    <button onClick={() => cat.id && handleUpdate(cat.id)} className="text-green-600 p-2 hover:bg-green-50 rounded-lg transition-colors">
                                                        <Check size={20} />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors">
                                                        <X size={20} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex-1 MIN-W-0">
                                                        <span className="font-medium text-gray-700 truncate block">{cat.name}</span>
                                                    </div>
                                                    <div className="flex gap-1 md:gap-2">
                                                        <button
                                                            onClick={() => cat.id && handleToggleVisible(cat.id, cat.visible ?? true)}
                                                            className={`p-2 rounded-lg transition-colors ${(cat.visible !== false)
                                                                ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                                                : 'text-red-500 hover:text-red-600 hover:bg-red-50'
                                                                }`}
                                                            title={(cat.visible !== false) ? "點擊隱藏" : "點擊顯示"}
                                                        >
                                                            {(cat.visible !== false) ? <Eye size={16} /> : <EyeOff size={16} />}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setEditingId(cat.id!);
                                                                setEditForm(cat);
                                                            }}
                                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => cat.id && handleDelete(cat.id)}
                                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
        </div>
    );
}
