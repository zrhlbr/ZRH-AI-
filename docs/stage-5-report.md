# Stage 5 瀹屾暣楠屾敹鎶ュ憡锛欿nowledge Platform Foundation

> 鏃ユ湡锛?026-07-31  
> 鍩虹嚎锛歋tage 4 `c24086b`  
> 绛栫暐锛氭柟妗?B锛圵IP Checkpoint 鈫?鎸夋ā鍧楄ˉ榻?鈫?鍒?Commit锛? 
> 绾︽潫锛氫笉鍒犻櫎銆佷笉閲嶅啓銆佷笉閲嶆柊璁捐锛涗笌 Stage 4 AI Gateway 鍏煎

---

## 涓€銆佺粨璁?
**Stage 5 Knowledge Platform Foundation 宸插畬鎴愬苟閫氳繃楠屾敹銆?*

鏍稿績閾捐矾鍙敤锛氫笂浼?鈫?瑙ｆ瀽 鈫?鍒嗗潡 鈫?Embedding 鈫?鍚戦噺鍏ュ簱 鈫?Keyword / Semantic / Hybrid 妫€绱?鈫?鍓嶇鐭ヨ瘑椤点€?
---

## 浜屻€丟it 鎻愪氦閾?
| SHA | 璇存槑 |
|---|---|
| `2087cd5` | Stage 5 WIP Checkpoint |
| `a85c034` | Document lifecycle |
| `8cd4876` | Chunk auto strategy |
| `3da5898` | Embedding provider hardening |
| `97ac2d4` | Vector JSONB safety |
| `6252e39` | Retriever permission + response contract |
| `1010d73` | Frontend trash/preview/download/health |
| `2ed0333` | Retriever embedding fallback |
| **HEAD** | 鏈姤鍛婃彁浜ゅ悗鏇存柊 |

---

## 涓夈€佸畬鎴愬害锛堥獙鏀跺悗锛?
| 妯″潡 | 瀹屾垚搴?| 澶囨敞 |
|---|---|---|
| Document | 95% | 涓婁紶/CRUD/鍥炴敹绔?閲嶈В鏋愭竻鐞?|
| Folder | 90% | CRUD 瀹屾暣 |
| Parser | 90% | 10 绫绘牸寮?|
| Chunk | 90% | auto/fixed/heading + maxChunks |
| Embedding | 90% | Ollama + 閲嶈瘯 + health锛涗緷璧?`nomic-embed-text` |
| Vector | 85% | JSONB + 浣欏鸡锛涢潪鍘熺敓 pgvector |
| Retriever | 90% | 鏉冮檺杩囨护 + hybrid锛沞mbedding 澶辫触鍙檷绾?|
| Permissions | 75% | public/company/private 鍙敤锛況ole/department 绠€鍖?|
| Search | 90% | keyword/semantic/hybrid 楠屾敹閫氳繃 |
| Storage | 90% | 鏈湴鍝堝笇瀛樺偍 |
| Task | 80% | 鐘舵€佹満鍙敤锛涙棤鐙珛 worker |
| Health | 90% | `/knowledge/status` |
| API | 95% | `/api/v1/knowledge/*` |
| Frontend | 90% | 鍒楄〃/涓婁紶/妫€绱?鍥炴敹绔?棰勮/涓嬭浇/鍋ュ悍鏉?|
| Database | 95% | 琛ㄥ凡钀藉湴 |
| Migration | 95% | 宸插叆搴撲笖宸茶繘 Git |

---

## 鍥涖€佹柊澧?/ 鍏抽敭 API

| 鏂规硶 | 璺緞 | 璇存槑 |
|---|---|---|
| POST | `/api/v1/knowledge/upload` | 涓婁紶骞惰Е鍙?parse/chunk/embed |
| GET/POST/PATCH/DELETE | `/api/v1/knowledge/folders` | 鏂囦欢澶?|
| GET/PATCH/DELETE | `/api/v1/knowledge/documents...` | 鏂囨。 CRUD / preview / download / move / copy / restore |
| POST | `/api/v1/knowledge/documents/:id/parse` | 閲嶈В鏋?|
| POST | `/api/v1/knowledge/documents/:id/reindex` | 閲嶅缓鍚戦噺 |
| GET | `/api/v1/knowledge/search` | keyword / semantic / hybrid |
| GET | `/api/v1/knowledge/status` | 鍋ュ悍涓庤鏁?|
| GET | `/api/v1/knowledge/formats` | 鏀寔鏍煎紡 |
| POST/DELETE | `/api/v1/knowledge/documents/:id/permissions` | 鎺堟潈 |

---

## 浜斻€佹暟鎹〃锛圫tage 5锛?
- `knowledge_folders`
- `knowledge_documents`
- `knowledge_document_versions`
- `knowledge_chunks`
- `knowledge_tags` / `knowledge_document_tags`
- `knowledge_vectors`锛圝SONB embedding锛?- `embedding_providers` / `vector_providers`
- `embedding_tasks`
- `document_permissions`

Migration锛歚20260731065502_stage5_knowledge_platform`

---

## 鍏€佹祴璇曠粨鏋?
| 妫€鏌ラ」 | 缁撴灉 |
|---|---|
| Backend `tsc` | 鉁?|
| Frontend `tsc` + Vite build | 鉁?|
| Docker `zrh-ai-api/web` rebuild | 鉁?healthy |
| `/api/v1/health` | 鉁?database/redis/ollama online |
| 鐧诲綍 + Knowledge 鏉冮檺 | 鉁?|
| 涓婁紶 Markdown | 鉁?status鈫抍hunked鈫抜ndexed |
| Keyword search | 鉁?|
| Semantic / Hybrid search | 鉁咃紙鎷夊彇 `nomic-embed-text` 鍚庯級 |
| `/api/v1/ai/models`锛圫tage 4锛?| 鉁?鍏煎锛宑ode=0 |
| 鍓嶇 `http://localhost:3010` | 鉁?200 |

鍐掔儫鎽樿锛?
- documents=2, chunks=2, vectors=2
- embedding provider online
- hybrid 鍛戒腑 smoke 鏂囨。锛坰core 鈮?0.70锛?
---

## 涓冦€侀闄╀笌鍚庣画

1. **Embedding 妯″瀷渚濊禆**锛氶渶鏈満 Ollama 瀛樺湪 `nomic-embed-text`锛涙湭瀹夎鏃?semantic 闄嶇骇涓?keyword銆?2. **鍚戦噺鍏ㄨ〃鎵弿**锛欽SONB + 搴旂敤灞備綑寮︼紝鏁版嵁閲忓ぇ鏃堕渶鍗囩骇鐪?pgvector / 绱㈠紩銆?3. **鏉冮檺绠€鍖?*锛歞epartment / role 缁嗙矑搴︿粛灞炲悗缁寮恒€?4. **鏃犵嫭绔嬩换鍔?Worker**锛歟mbedding 褰撳墠涓鸿繘绋嬪唴寮傛锛涜繘绋嬮噸鍚彲鑳戒涪鏈畬鎴愪换鍔°€?5. **`_prisma_migrations` 鍘嗗彶娈嬬暀**锛氬瓨鍦ㄤ竴鏉″凡 rollback 鐨勫悓鍚?Stage 5 璁板綍锛屼笉褰卞搷褰撳墠杩愯銆?
---

## 鍏€佷笌 Stage 4 鍏煎鎬?
- 鏈慨鏀?AI Gateway / Model Router / Provider 鏍稿績琛屼负
- Knowledge 涓虹嫭绔?Nest 妯″潡
- 浠呭鐢?`OLLAMA_BASE_URL` 涓庢棦鏈?JWT/RBAC/闄愭祦
- AI models API 鍐掔儫閫氳繃

---

## 涔濄€佹槸鍚﹀缓璁繘鍏ヤ笅涓€闃舵

**寤鸿锛歋tage 5 Foundation 鍙粨椤广€?*

涓嬩竴闃舵鍙€冭檻锛?
- 鐪?pgvector / 鍚戦噺绱㈠紩
- Embedding 浠诲姟闃熷垪
- Chat + Knowledge RAG 瀵规帴锛堝湪 Gateway 涔嬩笂锛?- 鏉冮檺妯″瀷瀹屽杽

---

*Stage 5 楠屾敹鎶ュ憡瀹氱銆?
