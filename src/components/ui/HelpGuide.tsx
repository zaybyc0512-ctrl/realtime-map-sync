import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HelpCircle, Map as MapIcon, Users, User, Settings } from 'lucide-react';

export const HelpGuide = () => {
    const [activeTab, setActiveTab] = useState<'BASIC' | 'HOST' | 'GUEST'>('BASIC');

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-blue-600" title="ヘルプ">
                    <HelpCircle className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <HelpCircle className="h-5 w-5" />
                        使い方ガイド
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4 mt-2">
                    {/* Unique Tabs Implementation */}
                    <div className="flex gap-2 border-b pb-2">
                        <Button
                            variant={activeTab === 'BASIC' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('BASIC')}
                            className="gap-2"
                        >
                            <MapIcon className="h-4 w-4" /> 基本操作
                        </Button>
                        <Button
                            variant={activeTab === 'HOST' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('HOST')}
                            className="gap-2"
                        >
                            <Users className="h-4 w-4" /> ホスト (親)
                        </Button>
                        <Button
                            variant={activeTab === 'GUEST' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('GUEST')}
                            className="gap-2"
                        >
                            <User className="h-4 w-4" /> ゲスト (子)
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {activeTab === 'BASIC' && (
                            <div className="space-y-4 text-sm leading-relaxed">
                                <section className="bg-gray-50 p-3 rounded-lg border">
                                    <h3 className="font-bold text-base mb-2 flex items-center gap-2">
                                        <MapIcon className="h-4 w-4 text-blue-500" /> 基本操作
                                    </h3>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li><strong>マップの移動:</strong> 画面をドラッグして移動（スペースキー + ドラッグも可）</li>
                                        <li><strong>ズーム:</strong> マウスホイールで拡大・縮小</li>
                                        <li><strong>ピンの追加:</strong> ポインタモード中に <strong>「Altキー + クリック」</strong></li>
                                        <li><strong>ピンの編集:</strong> ピンをクリック後、表示される吹き出しをクリックして編集・削除</li>
                                        <li><strong>ツールの切替:</strong> <strong>右上</strong>のパネルで「移動/ピン」と「ペン」を切り替え</li>
                                        <li><strong>全体表示:</strong> 「全体表示」ボタンで画像を画面サイズに合わせる</li>
                                        <li><strong>保存:</strong> マップの状態を画像またはJSONファイルとして保存可能</li>
                                    </ul>
                                </section>
                            </div>
                        )}

                        {activeTab === 'HOST' && (
                            <div className="space-y-4 text-sm leading-relaxed">
                                <section className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                    <h3 className="font-bold text-base mb-2 flex items-center gap-2">
                                        <Users className="h-4 w-4 text-blue-600" /> ホスト (親)
                                    </h3>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li><strong>部屋の作成:</strong> 「部屋を作成」ボタンを押し、表示されたPeer IDをコピーしてゲストに伝えてください。</li>
                                        <li><strong>権限設定:</strong> 歯車アイコンから「権限付与時間」と「再申請クールタイム」を変更できます。</li>
                                        <li><strong>リクエスト承認:</strong> ゲストから編集リクエストが届くと通知が出ます。「許可」または「拒否」を選択してください。</li>
                                        <li><strong>権限剥奪:</strong> ゲストリストの「盾アイコン」をクリックすると、強制的に権限を剥奪できます。</li>
                                    </ul>
                                </section>
                            </div>
                        )}

                        {activeTab === 'GUEST' && (
                            <div className="space-y-4 text-sm leading-relaxed">
                                <section className="bg-green-50 p-3 rounded-lg border border-green-100">
                                    <h3 className="font-bold text-base mb-2 flex items-center gap-2">
                                        <User className="h-4 w-4 text-green-600" /> ゲスト (子)
                                    </h3>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li><strong>部屋に参加:</strong> 「部屋に参加」ボタンを押し、ホストから受け取ったIDを入力して接続します。</li>
                                        <li><strong>自動同期:</strong> 接続が成功すると、ホストの画像と書き込みデータが自動的に同期されます。</li>
                                        <li><strong>編集リクエスト:</strong> 編集したい場合は、画面右上の「鍵アイコン（編集リクエスト）」を押して申請してください。</li>
                                        <li><strong>制限:</strong> 許可されていない間は、ペンやピン追加などの操作はできません。</li>
                                    </ul>
                                </section>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
