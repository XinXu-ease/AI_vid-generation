// ============ 全局数据 ============
let appData = {
    assets: null,
    project: null,
    currentShotId: null,
    editingMode: false
};

// ============ 数据管理系统 ============
class DataManager {
    static STORAGE_KEY = 'project_data';

    // 初始化 - 从 localStorage 加载或从 fetch 加载
    static async init() {
        const cached = localStorage.getItem(DataManager.STORAGE_KEY);
        if (cached) {
            appData.project = JSON.parse(cached);
            console.log('✅ 从本地缓存加载项目数据');
        } else {
            // 从 project.json 加载
            try {
                const res = await fetch('project.json');
                appData.project = await res.json();
                DataManager.save();
                console.log('✅ 从 project.json 加载项目数据并保存到缓存');
            } catch (e) {
                console.error('❌ 加载项目数据失败：', e);
            }
        }
        
        // 初始化displayOrder - 如果没有则使用shotNumber
        if (appData.project?.shots) {
            appData.project.shots.forEach((shot, index) => {
                if (!shot.displayOrder) {
                    shot.displayOrder = shot.shotNumber || index + 1;
                }
            });
        }
    }

    // 保存整个项目到 localStorage
    static save() {
        if (appData.project) {
            localStorage.setItem(DataManager.STORAGE_KEY, JSON.stringify(appData.project));
            console.log('💾 项目数据已保存到 localStorage');
        }
    }

    // 更新指定分镜的属性
    static updateShot(shotId, updates) {
        if (!appData.project) return;

        const shot = appData.project.shots.find(s => s.shotId === shotId);
        if (!shot) return;

        // 更新属性
        Object.assign(shot, updates);
        shot.lastModified = new Date().toISOString();

        // 保存数据
        DataManager.save();
        console.log(`✅ 分镜 ${shotId} 已更新：`, updates);

        return shot;
    }

    // 获取指定分镜
    static getShot(shotId) {
        if (!appData.project) return null;
        return appData.project.shots.find(s => s.shotId === shotId);
    }

    // 获取所有分镜
    static getAllShots() {
        return appData.project?.shots || [];
    }

    // 导出项目数据为 JSON 字符串（用于下载）
    static exportJSON() {
        if (!appData.project) return '';
        return JSON.stringify(appData.project, null, 2);
    }

    // 下载项目数据为文件
    static downloadProjectJSON() {
        const json = DataManager.exportJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'project.json';
        a.click();
        URL.revokeObjectURL(url);
        console.log('📥 项目数据已下载');
    }
}

// ============ 初始化 ============
document.addEventListener('DOMContentLoaded', async () => {
    await loadAllData();
    await DataManager.init(); // 加载项目数据到缓存
    setupEventListeners();
    
    // 恢复sidebar状态
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
        document.getElementById('sidebar').classList.add('collapsed');
        document.querySelector('.main-content').classList.add('sidebar-collapsed');
    }
    
    renderOverviewPage();
});

// ============ 数据加载 ============
async function loadAllData() {
    try {
        // 加载 assets.json
        const assetsRes = await fetch('assets.json');
        appData.assets = await assetsRes.json();

        // 加载 project.json
        const projectRes = await fetch('project.json');
        appData.project = await projectRes.json();

        // 初始化displayOrder - 如果没有则使用shotNumber
        if (appData.project.shots) {
            appData.project.shots.forEach((shot, index) => {
                if (!shot.displayOrder) {
                    shot.displayOrder = shot.shotNumber || index + 1;
                }
            });
        }

        // 加载 narrative-stages.json
        try {
            const stagesRes = await fetch('narrative-stages.json');
            appData.narrativeStages = await stagesRes.json();
        } catch (e) {
            console.warn('⚠️ narrative-stages.json 加载失败:', e);
            appData.narrativeStages = null;
        }

        console.log('✅ 所有数据加载成功', appData);
    } catch (error) {
        console.error('❌ 数据加载失败：', error);
    }
}

// ============ 事件监听 ============
function setupEventListeners() {
    // 导航按钮
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            switchPage(page);
        });
    });

    // 资产库标签页
    const assetTabs = document.querySelectorAll('.asset-tab');
    assetTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchAssetTab(tab.dataset.assetType);
        });
    });

    // 模态框按钮
    document.getElementById('continueBtn')?.addEventListener('click', closeConsistencyModal);
    document.getElementById('cancelBtn')?.addEventListener('click', closeConsistencyModal);

    // 编辑模式切换按钮 - 延迟添加，因为页面加载时还不存在
    setTimeout(() => {
        const editToggleBtn = document.getElementById('editModeToggle');
        if (editToggleBtn) {
            editToggleBtn.addEventListener('click', toggleEditMode);
        }
    }, 100);
}

// ============ Sidebar 展开/收回 ============
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('sidebar-collapsed');
    
    // 保存状态到localStorage
    const isCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebarCollapsed', isCollapsed);
}

// ============ 页面切换 ============
function switchPage(pageName) {
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // 显示指定页面
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // 更新导航按钮状态
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === pageName);
    });

    // 根据页面类型渲染内容
    if (pageName === 'overview') {
        renderOverviewPage();
    } else if (pageName === 'assets') {
        renderAssetsPage();
    } else if (pageName === 'control') {
        renderControlPage();
    }
}

// ============ 页面1：项目总览 ============
function renderOverviewPage() {
    if (!appData.project) return;

    const project = appData.project;
    const shots = DataManager.getAllShots();
    
    // 计算真实的统计数据
    const generatedCount = shots.filter(s => s.isGenerated).length;
    const completionRate = shots.length > 0 ? Math.round((generatedCount / shots.length) * 100) : 0;

    // 更新剧集信息
    document.getElementById('episodeTitle').textContent = project.title;
    document.getElementById('episodeSummary').textContent = project.summary;
    document.getElementById('totalShots').textContent = shots.length;
    document.getElementById('completedShots').textContent = generatedCount;
    document.getElementById('completionRate').textContent = completionRate + '%';

    // 渲染分镜时间线
    renderTimeline(shots);
}

function renderTimeline(shots) {
    const timeline = document.getElementById('overviewTimeline');
    timeline.innerHTML = '';

    // 获取叙事阶段数据
    let stages = [];
    const localStorageData = localStorage.getItem('project_data');
    if (localStorageData) {
        try {
            const parsedData = JSON.parse(localStorageData);
            if (parsedData.narrativeStages && parsedData.narrativeStages.length > 0) {
                stages = parsedData.narrativeStages;
            }
        } catch (e) {
            console.warn('⚠️ 解析 localStorage 数据失败');
        }
    }

    if (!stages || stages.length === 0) {
        if (appData.narrativeStages && appData.narrativeStages.stages) {
            stages = appData.narrativeStages.stages;
        }
    }

    if (!stages || stages.length === 0) {
        stages = [
            { stageId: 'stage_001', stageName: '铺垫', stageOrder: 1, description: '故事背景与人物介绍' },
            { stageId: 'stage_002', stageName: '推进', stageOrder: 2, description: '情节发展与矛盾出现' },
            { stageId: 'stage_003', stageName: '转折', stageOrder: 3, description: '关键转折点' },
            { stageId: 'stage_004', stageName: '高潮', stageOrder: 4, description: '情感与动作高潮' },
            { stageId: 'stage_005', stageName: '收束', stageOrder: 5, description: '故事结局与余韵' }
        ];
    }

    // 渲染叙事阶段列表（带拖拽功能）
    timeline.style.display = 'flex';
    timeline.style.flexDirection = 'column';
    timeline.style.gap = '12px';

    stages.forEach((stage, idx) => {
        const shotsInStage = shots.filter(s => s.narrative_stage === stage.stageName);
        const shotCount = shotsInStage.length;

        // 容器 - 包含阶段项和展开内容
        const containerEl = document.createElement('div');
        containerEl.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 0;
        `;

        // 阶段项
        const stageEl = document.createElement('div');
        stageEl.className = 'timeline-stage-item';
        stageEl.draggable = true;
        stageEl.dataset.stageId = stage.stageId;
        stageEl.dataset.isExpanded = 'false';
        stageEl.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: #fdfaf0;
            border: 1px solid #e0ddd5;
            border-radius: 6px;
            cursor: move;
            transition: all 0.3s;
        `;

        stageEl.innerHTML = `
            <span style="color: #999; font-size: 16px; cursor: grab;">⋮⋮</span>
            <div style="flex: 1; min-width: 0;">
                <div class="stage-name-display" style="font-weight: 600; color: #2a2a2a; font-size: 13px; cursor: pointer; padding: 4px 6px; border-radius: 3px; transition: all 0.2s;">
                    阶段${stage.stageOrder} ${stage.stageName}
                </div>
            </div>
            <div style="white-space: nowrap; color: #666; font-size: 12px;">
                ${shotCount} 个分镜
            </div>
            <button class="toggle-expand-btn" style="background: none; border: none; cursor: pointer; font-size: 14px; color: #A7C957; padding: 4px 8px; border-radius: 3px; transition: all 0.3s;">▼</button>
        `;

        // 展开按钮事件
        const toggleBtn = stageEl.querySelector('.toggle-expand-btn');
        const shotsContainerEl = document.createElement('div');
        shotsContainerEl.className = 'stage-shots-container';
        shotsContainerEl.style.cssText = `
            display: none;
            flex-direction: column;
            gap: 8px;
            padding: 12px;
            background: #ffffff;
            border: 1px solid #e0ddd5;
            border-top: none;
            border-radius: 0 0 6px 6px;
        `;

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = stageEl.dataset.isExpanded === 'true';
            stageEl.dataset.isExpanded = !isExpanded;
            shotsContainerEl.style.display = !isExpanded ? 'flex' : 'none';
            toggleBtn.style.transform = !isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
        });

        // 渲染该阶段下的分镜卡片
        const updateShotsDisplay = () => {
            shotsContainerEl.innerHTML = '';
            let currentShotsInStage = shots.filter(s => s.narrative_stage === stage.stageName);
            
            // 按displayOrder排序
            currentShotsInStage = currentShotsInStage.sort((a, b) => {
                return (a.displayOrder || a.shotNumber) - (b.displayOrder || b.shotNumber);
            });
            
            if (currentShotsInStage.length === 0) {
                shotsContainerEl.innerHTML = '<p style="text-align: center; color: #999; font-size: 12px;">暂无分镜</p>';
                return;
            }

            currentShotsInStage.forEach(shot => {
                const shotCard = document.createElement('div');
                shotCard.className = 'stage-shot-card';
                shotCard.draggable = true;
                shotCard.dataset.shotId = shot.shotId;
                shotCard.dataset.shotStage = shot.narrative_stage;
                shotCard.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px;
                    background: #fdfaf0;
                    border: 1px solid #e0ddd5;
                    border-radius: 4px;
                    cursor: move;
                    transition: all 0.2s;
                `;

                const statusIcon = shot.status === 'completed' ? '✓' : '⏳';
                shotCard.innerHTML = `
                    <span style="color: #999; font-size: 12px;">⋮</span>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 12px; font-weight: 600; color: #2a2a2a;">${shot.title}</div>
                    </div>
                    <div style="white-space: nowrap; font-size: 11px; color: #666;">
                        ${statusIcon} ${shot.status === 'completed' ? '已生成' : '待生成'}
                    </div>
                `;

                let isDragging = false; // 拖拽标记

                // 分镜卡片点击事件 - 跳转到分镜配置
                shotCard.addEventListener('click', (e) => {
                    // 只在没有拖拽的情况下处理点击
                    if (!isDragging) {
                        appData.currentShotId = shot.shotId;
                        console.log('跳转到分镜:', shot.shotId, shot.title);
                        switchPage('control');
                    }
                    isDragging = false; // 重置标记
                });

                // 分镜卡片拖拽事件
                shotCard.addEventListener('dragstart', (e) => {
                    isDragging = true; // 标记正在拖拽
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('shotId', shot.shotId);
                    e.dataTransfer.setData('fromStage', stage.stageName);
                    shotCard.style.opacity = '0.5';
                });

                shotCard.addEventListener('dragend', (e) => {
                    shotCard.style.opacity = '1';
                });

                shotCard.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    shotCard.style.background = '#f0ebe0';
                });

                shotCard.addEventListener('dragleave', (e) => {
                    shotCard.style.background = '#fdfaf0';
                });

                // 支持分镜卡片间的排序
                shotCard.addEventListener('drop', (e) => {
                    e.preventDefault();
                    shotCard.style.background = '#fdfaf0';
                    
                    const draggedShotId = e.dataTransfer.getData('shotId');
                    if (draggedShotId && draggedShotId !== shot.shotId) {
                        const draggedShot = shots.find(s => s.shotId === draggedShotId);
                        if (draggedShot && draggedShot.narrative_stage === stage.stageName) {
                            // 同一阶段内移动 - 交换displayOrder
                            [draggedShot.displayOrder, shot.displayOrder] = [shot.displayOrder, draggedShot.displayOrder];
                            
                            // 保存到 localStorage
                            const projectData = JSON.parse(localStorage.getItem('project_data') || '{}');
                            projectData.shots = shots;
                            localStorage.setItem('project_data', JSON.stringify(projectData));
                            
                            // 重新渲染该阶段的分镜但保持展开状态
                            updateShotsDisplay();
                        }
                    }
                });

                shotsContainerEl.appendChild(shotCard);
            });
        };

        // 初始化分镜卡片
        updateShotsDisplay();

        // 阶段项拖拽事件
        stageEl.addEventListener('dragstart', (e) => {
            if (e.target.closest('.toggle-expand-btn') || e.target.closest('.stage-name-display')) {
                e.preventDefault();
                return;
            }
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('stageId', stage.stageId);
            stageEl.style.opacity = '0.5';
        });

        stageEl.addEventListener('dragend', (e) => {
            stageEl.style.opacity = '1';
        });

        stageEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            // 支持分镜卡片在未展开时拖入阶段
            if (e.dataTransfer.types.includes('shotId')) {
                stageEl.style.background = '#f0ebe0';
            }
        });

        stageEl.addEventListener('dragleave', (e) => {
            if (e.dataTransfer.types && e.dataTransfer.types.includes('shotId')) {
                stageEl.style.background = '#fdfaf0';
            }
        });

        // 处理分镜卡片拖到阶段项（未展开时也支持）
        stageEl.addEventListener('drop', (e) => {
            const shotId = e.dataTransfer.getData('shotId');
            if (shotId) {
                e.preventDefault();
                stageEl.style.background = '#fdfaf0';
                
                const shot = shots.find(s => s.shotId === shotId);
                const fromStage = e.dataTransfer.getData('fromStage');
                if (shot && shot.narrative_stage !== stage.stageName) {
                    // 记录展开状态
                    const expandedStages = new Set();
                    document.querySelectorAll('.timeline-stage-item[data-is-expanded="true"]').forEach(el => {
                        expandedStages.add(el.dataset.stageId);
                    });
                    
                    shot.narrative_stage = stage.stageName;
                    // 保存到 localStorage
                    const projectData = JSON.parse(localStorage.getItem('project_data') || '{}');
                    projectData.shots = shots;
                    localStorage.setItem('project_data', JSON.stringify(projectData));
                    
                    // 标记两个阶段保持展开
                    expandedStages.add(stage.stageId);
                    if (fromStage) {
                        const fromStageObj = stages.find(s => s.stageName === fromStage);
                        if (fromStageObj) expandedStages.add(fromStageObj.stageId);
                    }
                    
                    // 重新渲染并恢复展开状态
                    renderTimeline(shots);
                    
                    // 恢复展开状态
                    setTimeout(() => {
                        expandedStages.forEach(stageId => {
                            const stageEl = document.querySelector(`.timeline-stage-item[data-stage-id="${stageId}"]`);
                            if (stageEl) {
                                stageEl.dataset.isExpanded = 'true';
                                const shotsContainer = stageEl.nextElementSibling;
                                if (shotsContainer && shotsContainer.classList.contains('stage-shots-container')) {
                                    shotsContainer.style.display = 'flex';
                                    const toggleBtn = stageEl.querySelector('.toggle-expand-btn');
                                    if (toggleBtn) toggleBtn.style.transform = 'rotate(180deg)';
                                }
                            }
                        });
                    }, 0);
                }
            }
        });

        // 处理分镜卡片拖到展开的阶段容器
        shotsContainerEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (e.dataTransfer.types.includes('shotId')) {
                shotsContainerEl.style.background = '#f0ebe0';
            }
        });

        shotsContainerEl.addEventListener('dragleave', (e) => {
            shotsContainerEl.style.background = '#ffffff';
        });

        shotsContainerEl.addEventListener('drop', (e) => {
            e.preventDefault();
            shotsContainerEl.style.background = '#ffffff';
            
            const shotId = e.dataTransfer.getData('shotId');
            const fromStage = e.dataTransfer.getData('fromStage');
            if (shotId) {
                const shot = shots.find(s => s.shotId === shotId);
                if (shot && shot.narrative_stage !== stage.stageName) {
                    // 记录展开状态
                    const expandedStages = new Set();
                    document.querySelectorAll('.timeline-stage-item[data-is-expanded="true"]').forEach(el => {
                        expandedStages.add(el.dataset.stageId);
                    });
                    
                    shot.narrative_stage = stage.stageName;
                    // 保存到 localStorage
                    const projectData = JSON.parse(localStorage.getItem('project_data') || '{}');
                    projectData.shots = shots;
                    localStorage.setItem('project_data', JSON.stringify(projectData));
                    
                    // 标记两个阶段保持展开
                    expandedStages.add(stage.stageId);
                    if (fromStage) {
                        const fromStageObj = stages.find(s => s.stageName === fromStage);
                        if (fromStageObj) expandedStages.add(fromStageObj.stageId);
                    }
                    
                    // 重新渲染并恢复展开状态
                    renderTimeline(shots);
                    
                    // 恢复展开状态
                    setTimeout(() => {
                        expandedStages.forEach(stageId => {
                            const stageEl = document.querySelector(`.timeline-stage-item[data-stage-id="${stageId}"]`);
                            if (stageEl) {
                                stageEl.dataset.isExpanded = 'true';
                                const shotsContainer = stageEl.nextElementSibling;
                                if (shotsContainer && shotsContainer.classList.contains('stage-shots-container')) {
                                    shotsContainer.style.display = 'flex';
                                    const toggleBtn = stageEl.querySelector('.toggle-expand-btn');
                                    if (toggleBtn) toggleBtn.style.transform = 'rotate(180deg)';
                                }
                            }
                        });
                    }, 0);
                }
            }
        });

        // 在阶段项的dragover和drop事件中处理阶段拖拽
        stageEl.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedStageId = e.dataTransfer.getData('stageId');
            if (draggedStageId && draggedStageId !== stage.stageId) {
                const draggedStage = stages.find(s => s.stageId === draggedStageId);
                if (draggedStage) {
                    [draggedStage.stageOrder, stage.stageOrder] = [stage.stageOrder, draggedStage.stageOrder];
                    stages.sort((a, b) => a.stageOrder - b.stageOrder);
                    // 保存到 localStorage
                    const projectData = JSON.parse(localStorage.getItem('project_data') || '{}');
                    projectData.narrativeStages = stages;
                    localStorage.setItem('project_data', JSON.stringify(projectData));
                    renderTimeline(shots);
                }
            }
        });

        stageEl.addEventListener('mouseenter', () => {
            stageEl.style.borderColor = '#A7C957';
        });

        stageEl.addEventListener('mouseleave', () => {
            stageEl.style.borderColor = '#e0ddd5';
        });

        // 添加编辑功能
        const stageNameDisplay = stageEl.querySelector('.stage-name-display');
        stageNameDisplay.addEventListener('click', () => {
            const originalText = stage.stageName;
            stageNameDisplay.contentEditable = 'true';
            stageNameDisplay.style.background = 'white';
            stageNameDisplay.style.border = '1px solid #A7C957';
            stageNameDisplay.textContent = `阶段${stage.stageOrder} ${originalText}`;
            stageNameDisplay.focus();

            // 选中阶段名部分
            const range = document.createRange();
            const start = `阶段${stage.stageOrder} `.length;
            if (stageNameDisplay.firstChild) {
                range.setStart(stageNameDisplay.firstChild, start);
                range.setEnd(stageNameDisplay.firstChild, stageNameDisplay.textContent.length);
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(range);
            }

            function saveEdit() {
                const fullText = stageNameDisplay.textContent;
                const prefix = `阶段${stage.stageOrder} `;
                const newName = fullText.startsWith(prefix) ? fullText.substring(prefix.length) : fullText;

                if (newName.trim() && newName !== originalText) {
                    // 更新stage名称
                    const oldName = stage.stageName;
                    stage.stageName = newName.trim();
                    
                    // 更新所有该阶段的分镜
                    shots.forEach(shot => {
                        if (shot.narrative_stage === oldName) {
                            shot.narrative_stage = newName.trim();
                        }
                    });

                    const projectData = JSON.parse(localStorage.getItem('project_data') || '{}');
                    projectData.narrativeStages = stages;
                    projectData.shots = shots;
                    localStorage.setItem('project_data', JSON.stringify(projectData));
                }

                stageNameDisplay.contentEditable = 'false';
                stageNameDisplay.style.background = 'transparent';
                stageNameDisplay.style.border = 'none';
                renderTimeline(shots);
            }

            stageNameDisplay.addEventListener('blur', saveEdit, { once: true });
            stageNameDisplay.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveEdit();
                } else if (e.key === 'Escape') {
                    stageNameDisplay.contentEditable = 'false';
                    stageNameDisplay.style.background = 'transparent';
                    stageNameDisplay.style.border = 'none';
                    renderTimeline(shots);
                }
            });
        });

        containerEl.appendChild(stageEl);
        containerEl.appendChild(shotsContainerEl);
        timeline.appendChild(containerEl);
    });
}

function renderOverviewShots(shots) {
    const grid = document.getElementById('overviewShotsGrid');
    grid.innerHTML = '';

    shots.forEach(shot => {
        let statusIcon = '⏳';
        let statusText = '待生成';
        if (shot.status === 'completed') {
            statusIcon = '✓';
            statusText = '已生成';
        }

        const card = document.createElement('div');
        card.className = 'shot-card';
        card.innerHTML = `
            <div class="shot-card-header">
                <span class="shot-card-title">${shot.title}</span>
                <span class="shot-card-stage">${getNarrativeStageLabel(shot.narrative_stage)}</span>
            </div>
            <p class="shot-card-desc">${shot.description || '（无描述）'}</p>
            <div class="shot-card-meta">
                <span>⏱️ ${shot.duration || '-'}</span>
                <span>${statusIcon} ${statusText}</span>
            </div>
        `;
        card.addEventListener('click', () => {
            appData.currentShotId = shot.shotId;
            switchPage('control');
        });
        grid.appendChild(card);
    });
}

// ============ 页面2：固定资产库 ============
function renderAssetsPage() {
    if (!appData.assets) return;

    // 默认显示角色资产
    switchAssetTab('characters');
}

function switchAssetTab(assetType) {
    // 更新标签按钮状态
    document.querySelectorAll('.asset-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.assetType === assetType);
    });

    // 渲染资产卡片
    renderAssetCards(assetType);
}

function renderAssetCards(assetType) {
    const grid = document.getElementById('assetsGrid');
    grid.innerHTML = '';

    const assets = appData.assets[assetType] || [];
    let icons = {
        characters: '👤',
        scenes: '🏞️',
        props: '🎁',
        styles: '🎨'
    };

    // 渲染现有资产卡片
    assets.forEach(asset => {
        const card = document.createElement('div');
        card.className = 'asset-card';

        const icon = icons[assetType] || '📦';

        card.innerHTML = `
            <div class="asset-thumbnail">${icon}</div>
            <div class="asset-info">
                <div class="asset-name">${asset.name}</div>
                <div class="asset-desc">${asset.description || asset.style || ''}</div>
                <div class="asset-action">
                    <button class="btn-small btn-add" onclick="openAssetEditModal('${asset.id}', '${assetType}')">
                        ✎ 编辑
                    </button>
                </div>
            </div>
        `;

        grid.appendChild(card);
    });

    // 添加"添加资产"卡片
    const addCard = document.createElement('div');
    addCard.className = 'asset-card asset-add-card';
    addCard.innerHTML = `
        <div class="asset-thumbnail asset-add-thumbnail">+</div>
        <div class="asset-info">
            <div class="asset-name">添加资产</div>
            <div class="asset-desc">新增一个资产</div>
            <div class="asset-action">
                <button class="btn-small btn-add" onclick="openAssetEditModal(null, '${assetType}')">
                    + 添加
                </button>
            </div>
        </div>
    `;
    grid.appendChild(addCard);
}

function addAssetToShot(assetId, assetType) {
    if (!appData.currentShotId) {
        alert('请先在分镜控制页面选择一个分镜');
        return;
    }
    console.log(`✅ 已将资产 ${assetId} (${assetType}) 加入到分镜 ${appData.currentShotId}`);
    alert(`✅ 已成功将此资产加入到当前分镜！`);
}

// ============ 资产编辑弹窗 ============
let currentEditingAsset = null;
let currentEditingAssetType = null;
let assetTitleEditing = false;
let isCreatingNewAsset = false;

function openAssetEditModal(assetId, assetType) {
    // 处理新增模式（assetId 为 null 或 undefined）
    if (!assetId) {
        openAssetCreateModal(assetType);
        return;
    }

    // 找到资产 - 编辑模式
    const asset = appData.assets[assetType]?.find(a => a.id === assetId);
    if (!asset) return;

    currentEditingAsset = asset;
    currentEditingAssetType = assetType;
    isCreatingNewAsset = false;
    assetTitleEditing = false;

    // 重置标题UI状态 - 使用CSS classes确保稳定显示
    const titleEl = document.getElementById('assetEditTitle');
    const titleInput = document.getElementById('assetEditTitleInput');
    
    // 使用CSS class管理显示/隐藏状态，移除所有inline styles
    titleEl.classList.remove('hidden');
    titleInput.classList.remove('editing');
    
    // 填充弹窗内容
    titleEl.textContent = asset.name || '新建资产';
    titleInput.value = asset.name || '';
    document.getElementById('assetEditDescription').value = asset.description || '';

    // 清空额外属性容器
    const extraAttrContainer = document.getElementById('assetExtraAttributes');
    extraAttrContainer.innerHTML = '';

    // 动态加载已有的属性（除了必需的name和description）
    const excludeKeys = ['id', 'name', 'description', 'referenceImage'];
    for (const key in asset) {
        if (!excludeKeys.includes(key)) {
            const value = Array.isArray(asset[key]) ? asset[key].join(', ') : (asset[key] || '');
            const label = getAttributeLabel(key);
            addExtraAttributeField(extraAttrContainer, key, label, value, true);
        }
    }

    // 显示弹窗
    document.getElementById('assetEditModal').style.display = 'flex';
}

function openAssetCreateModal(assetType) {
    // 新增资产模式
    currentEditingAsset = {
        id: 'asset_' + Date.now(),
        name: '',
        description: ''
    };
    currentEditingAssetType = assetType;
    isCreatingNewAsset = true;
    assetTitleEditing = false;

    // 重置标题UI状态 - 使用CSS classes确保稳定显示
    const titleEl = document.getElementById('assetEditTitle');
    const titleInput = document.getElementById('assetEditTitleInput');
    
    // 使用CSS class管理显示/隐藏状态
    titleEl.classList.remove('hidden');
    titleInput.classList.remove('editing');
    
    // 填充弹窗内容 - 空白
    titleEl.textContent = '新建' + getAssetTypeName(assetType);
    titleInput.value = '';
    document.getElementById('assetEditDescription').value = '';

    // 清空额外属性容器
    const extraAttrContainer = document.getElementById('assetExtraAttributes');
    extraAttrContainer.innerHTML = '';

    // 显示弹窗
    document.getElementById('assetEditModal').style.display = 'flex';
}

function getAssetTypeName(assetType) {
    const typeNames = {
        'characters': '角色',
        'scenes': '场景',
        'props': '道具',
        'styles': '风格'
    };
    return typeNames[assetType] || '资产';
}

function getAttributeLabel(key) {
    const labelMap = {
        'outfit': '服装配备',
        'personality': '性格特征',
        'style': '场景风格',
        'lighting': '光线设置',
        'referenceImage': '参考图片'
    };
    return labelMap[key] || key;
}

function editAssetTitle() {
    if (assetTitleEditing) return;
    
    assetTitleEditing = true;
    const titleEl = document.getElementById('assetEditTitle');
    const titleInput = document.getElementById('assetEditTitleInput');
    
    // 使用CSS classes管理显示/隐藏，不使用inline styles
    titleEl.classList.add('hidden');
    titleInput.classList.add('editing');
    titleInput.focus();
}

function saveAssetTitle() {
    const titleInput = document.getElementById('assetEditTitleInput');
    const titleEl = document.getElementById('assetEditTitle');
    const newTitle = titleInput.value.trim();
    
    if (newTitle) {
        titleEl.textContent = newTitle;
    }
    
    // 使用CSS classes重置状态，不使用removeAttribute
    titleEl.classList.remove('hidden');
    titleInput.classList.remove('editing');
    assetTitleEditing = false;
}

function addExtraAttributeField(container, key, label, value = '', hasDelete = false) {
    const group = document.createElement('div');
    group.className = 'form-group';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'attr-field-wrapper';
    wrapper.dataset.key = key;
    
    const leftDiv = document.createElement('div');
    leftDiv.className = 'attr-field-left';
    
    const labelEl = document.createElement('label');
    labelEl.style.display = label ? 'block' : 'none';
    labelEl.textContent = label || key;
    
    const textarea = document.createElement('textarea');
    textarea.className = 'form-control';
    textarea.rows = 2;
    textarea.value = value;
    textarea.dataset.key = key;
    
    leftDiv.appendChild(labelEl);
    leftDiv.appendChild(textarea);
    wrapper.appendChild(leftDiv);
    
    if (hasDelete) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'attr-field-remove';
        deleteBtn.textContent = '×';
        deleteBtn.title = '删除此属性';
        deleteBtn.onclick = (e) => {
            e.preventDefault();
            group.remove();
        };
        wrapper.appendChild(deleteBtn);
    }
    
    group.appendChild(wrapper);
    container.appendChild(group);
}

function addAttributeField() {
    const name = prompt('请输入属性名称（英文）：');
    if (!name || !name.trim()) return;
    
    const label = prompt(`请输入属性显示名称（标签）\n默认为：${name}`);
    const extraAttrContainer = document.getElementById('assetExtraAttributes');
    
    addExtraAttributeField(extraAttrContainer, name.trim(), label || name, '', true);
}

function closeAssetEditModal() {
    document.getElementById('assetEditModal').style.display = 'none';
    
    // 重置标题编辑状态
    const titleEl = document.getElementById('assetEditTitle');
    const titleInput = document.getElementById('assetEditTitleInput');
    titleEl.classList.remove('hidden');
    titleInput.classList.remove('editing');
    
    currentEditingAsset = null;
    currentEditingAssetType = null;
    assetTitleEditing = false;
}

function saveAssetEdit() {
    if (!currentEditingAsset || !currentEditingAssetType) return;

    // 更新必需属性
    const titleInput = document.getElementById('assetEditTitleInput');
    const newName = titleInput.classList.contains('editing') ? titleInput.value : document.getElementById('assetEditTitle').textContent;
    
    // 检查名称 - 创建模式必须提供名称
    if (isCreatingNewAsset && !newName.trim()) {
        alert('❌ 请输入资产名称！');
        return;
    }
    
    currentEditingAsset.name = newName || currentEditingAsset.name;
    currentEditingAsset.description = document.getElementById('assetEditDescription').value;

    // 清除旧的额外属性
    const excludeKeys = ['id', 'name', 'description', 'referenceImage'];
    for (const key in currentEditingAsset) {
        if (!excludeKeys.includes(key)) {
            delete currentEditingAsset[key];
        }
    }

    // 更新额外属性
    const extraFields = document.querySelectorAll('#assetExtraAttributes [data-key]');
    extraFields.forEach(field => {
        const key = field.dataset.key;
        const value = field.value.trim();
        
        if (value) {
            if (key === 'outfit') {
                currentEditingAsset.outfit = value.split(',').map(s => s.trim()).filter(s => s);
            } else {
                currentEditingAsset[key] = value;
            }
        }
    });

    // 如果是创建新资产，需要添加到数组中
    if (isCreatingNewAsset) {
        appData.assets[currentEditingAssetType].push(currentEditingAsset);
    }

    console.log('✅ 资产已' + (isCreatingNewAsset ? '创建' : '保存') + ':', currentEditingAsset);
    
    // 保存到localStorage
    const projectData = JSON.parse(localStorage.getItem('project_data') || '{}');
    if (!projectData.assets) {
        projectData.assets = JSON.parse(JSON.stringify(appData.assets));
    }
    projectData.assets[currentEditingAssetType] = appData.assets[currentEditingAssetType];
    localStorage.setItem('project_data', JSON.stringify(projectData));

    alert('✅ 资产已成功' + (isCreatingNewAsset ? '创建' : '保存') + '！');
    
    // 重新渲染资产卡片
    renderAssetCards(currentEditingAssetType);
    
    closeAssetEditModal();
}

// ============ 页面3：分镜结构化控制 ============
function renderControlPage() {
    if (!appData.project) return;

    // 渲染分镜列表
    renderControlShotList();

    // 获取当前选中的分镜，如果没有则选择第一个
    if (!appData.currentShotId) {
        const shots = DataManager.getAllShots();
        appData.currentShotId = shots[0]?.shotId;
    }

    // 检查当前分镜的状态
    const currentShot = DataManager.getShot(appData.currentShotId);
    if (currentShot) {
        // 对于 pending 的分镜（未生成），默认进入可编辑状态
        if (currentShot.status === 'pending') {
            appData.editingMode = true;
        } else {
            // 对于已生成的分镜，默认为非编辑状态
            appData.editingMode = false;
        }
    }

    // 渲染配置表单和预览
    renderConfigForm();
    renderPreview();

    // 更新按钮文本和样式，根据编辑状态
    setTimeout(() => {
        const editToggleBtn = document.getElementById('editModeToggle');
        if (editToggleBtn && currentShot) {
            // 先移除所有旧的事件监听器
            const newBtn = editToggleBtn.cloneNode(true);
            editToggleBtn.parentNode.replaceChild(newBtn, editToggleBtn);
            
            const updatedBtn = document.getElementById('editModeToggle');
            
            // 根据编辑状态显示按钮文本
            if (appData.editingMode) {
                // 编辑模式：显示保存按钮
                updatedBtn.textContent = '💾 保存';
                updatedBtn.style.color = '#ffffff';
                updatedBtn.style.fontWeight = 'bold';
            } else {
                // 非编辑模式：显示编辑按钮
                updatedBtn.textContent = '✏️ 编辑';
                updatedBtn.style.color = '#ffffff';
                updatedBtn.style.fontWeight = 'normal';
            }
            
            // 添加新的事件监听器（只有一个）
            updatedBtn.addEventListener('click', handleSaveOrEdit);
            console.log('按钮事件已绑定:', currentShot.shotId, '编辑模式:', appData.editingMode);
        }
    }, 50);
}

function renderControlShotList() {
    const shotList = document.getElementById('controlShotList');
    shotList.innerHTML = '';

    const shots = DataManager.getAllShots();
    shots.forEach(shot => {
        const item = document.createElement('button');
        item.className = 'shot-list-item';
        if (shot.shotId === appData.currentShotId) {
            item.classList.add('active');
        }
        item.textContent = `${shot.title}`;
        item.addEventListener('click', () => {
            appData.currentShotId = shot.shotId;
            // 重要：不要这里重置 editingMode，让 renderControlPage 来处理
            renderControlPage();
        });
        shotList.appendChild(item);
    });
}

// ============ 编辑模式切换 ============

/**
 * 处理保存或编辑按钮的点击事件
 */
function handleSaveOrEdit() {
    const currentShot = DataManager.getShot(appData.currentShotId);
    if (!currentShot) return;

    // 如果在编辑模式，点击保存
    if (appData.editingMode) {
        saveChanges(currentShot);
        return;
    }

    // 如果不在编辑模式，进入编辑模式
    toggleEditMode();
}

function toggleEditMode() {
    const currentShot = DataManager.getShot(appData.currentShotId);
    if (!currentShot) return;

    // 进入编辑模式
    appData.editingMode = true;

    // 重新渲染表单，显示可编辑状态
    renderConfigForm();
    renderPreview();
    
    // 更新按钮文本 - 从编辑变成保存
    setTimeout(() => {
        const editToggleBtn = document.getElementById('editModeToggle');
        if (editToggleBtn) {
            editToggleBtn.textContent = '💾 保存';
            editToggleBtn.style.color = '#ffffff';
            editToggleBtn.style.fontWeight = 'bold';
            console.log('✅ 按钮已更新为保存状态');
        }
    }, 0);
}

// 保存表单更改
function saveChanges(currentShot) {
    // 收集表单数据
    const form = document.getElementById('configForm');
    
    // 获取所有输入字段值
    const titleInput = form.querySelector('input[type="text"]');
    const descriptionTextarea = form.querySelector('textarea');
    const narrativeRadios = form.querySelectorAll('input[name="narrativeStage"]');
    const emotionalSlider = form.querySelectorAll('input[type="range"]')[0];
    const rhythmSlider = form.querySelectorAll('input[type="range"]')[1];
    const cameraMotionRadios = form.querySelectorAll('input[name="cameraMotion"]');
    const refCheckbox = form.querySelector('input[name="refCheckbox"]');

    console.log('=== 开始保存 ===');
    console.log('当前分镜ID:', appData.currentShotId);

    const updates = {
        title: titleInput?.value?.trim() || currentShot.title,
        description: descriptionTextarea?.value?.trim() || currentShot.description,
        narrative_stage: Array.from(narrativeRadios).find(r => r.checked)?.value || currentShot.narrative_stage,
        emotionalIntensity: parseInt(emotionalSlider?.value) || currentShot.emotionalIntensity,
        rhythmIntensity: parseInt(rhythmSlider?.value) || currentShot.rhythmIntensity,
        cameraMotion: Array.from(cameraMotionRadios).find(r => r.checked)?.value || currentShot.cameraMotion,
        refPrevShot: refCheckbox?.checked || currentShot.refPrevShot
    };

    console.log('保存数据:', updates);

    // 更新数据到内存 + localStorage
    DataManager.updateShot(appData.currentShotId, updates);

    // 验证数据是否真的保存了
    const savedShot = DataManager.getShot(appData.currentShotId);
    console.log('保存验证 - 从内存读取:', savedShot.title);
    
    // 检查 localStorage
    const storageData = JSON.parse(localStorage.getItem(DataManager.STORAGE_KEY));
    const storageSavedShot = storageData?.shots?.find(s => s.shotId === appData.currentShotId);
    console.log('保存验证 - 从localStorage读取:', storageSavedShot?.title);

    // 保存后退出编辑模式
    appData.editingMode = false;

    console.log('保存完成，重新渲染...');

    // 刷新界面（无需弹窗，直接同步）
    renderConfigForm();
    renderPreview();
    renderControlPage(); // 重新渲染以更新按钮状态
    renderOverviewPage(); // 刷新总览页
}

function renderConfigForm() {
    const currentShot = DataManager.getShot(appData.currentShotId);
    if (!currentShot) return;

    const form = document.getElementById('configForm');
    form.innerHTML = '';

    // 确定是否只读 - 只要不在编辑模式就禁用
    const isReadonly = !appData.editingMode;

    // 分镜标题
    form.innerHTML += `
        <div class="form-group">
            <label class="form-label">分镜标题</label>
            <input type="text" class="form-input" value="${currentShot.title}" ${isReadonly ? 'disabled' : ''}>
        </div>
    `;

    // 叙事阶段 - 从 backend 数据读取
    let stages = [];
    
    // 优先使用 localStorage 中的数据（包含用户的修改）
    const localStorageData = localStorage.getItem('project_data');
    if (localStorageData) {
        try {
            const parsedData = JSON.parse(localStorageData);
            if (parsedData.narrativeStages && parsedData.narrativeStages.length > 0) {
                stages = parsedData.narrativeStages.map(s => s.stageName);
            }
        } catch (e) {
            console.warn('⚠️ 解析 localStorage 数据失败');
        }
    }

    // 如果 localStorage 中没有，使用从 narrative-stages.json 加载的数据
    if (stages.length === 0 && appData.narrativeStages && appData.narrativeStages.stages) {
        stages = appData.narrativeStages.stages.map(s => s.stageName);
    }

    // 如果都没有，使用默认值
    if (stages.length === 0) {
        stages = ['铺垫', '推进', '转折', '高潮', '收束'];
    }

    form.innerHTML += `
        <div class="form-group">
            <label class="form-label">📖 叙事阶段</label>
            <div class="form-radio-group">
                ${stages.map(stage => `
                    <label class="form-radio-item">
                        <input type="radio" name="narrativeStage" value="${stage}" 
                               ${currentShot.narrative_stage === stage ? 'checked' : ''} 
                               ${isReadonly ? 'disabled' : ''}>
                        <span>${stage}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `;

    // Prompt 输入框
    form.innerHTML += `
        <div class="form-group">
            <label class="form-label">📝 Prompt 描述</label>
            <textarea class="form-textarea" placeholder="输入分镜的详细描述..." 
                      ${isReadonly ? 'disabled' : ''}>${currentShot.description}</textarea>
        </div>
    `;

    // 角色绑定
    const charactersDisplay = currentShot.characters
        .map(charId => {
            const char = appData.assets.characters.find(c => c.id === charId);
            return char ? char.name : charId;
        })
        .join(', ') || '（未选择）';
    
    form.innerHTML += `
        <div class="form-group">
            <label class="form-label">👤 角色绑定</label>
            <input type="text" class="form-input" value="${charactersDisplay}" disabled>
            <button class="btn btn-secondary btn-small" 
                    ${isReadonly ? 'disabled' : ''} 
                    onclick="alert('点击打开角色选择面板')">选择角色</button>
        </div>
    `;

    // 场景绑定
    const sceneDisplay = currentShot.scenes.length > 0 
        ? appData.assets.scenes.find(s => s.id === currentShot.scenes[0])?.name || '选择场景...'
        : '选择场景...';
    
    form.innerHTML += `
        <div class="form-group">
            <label class="form-label">🏞️ 场景绑定</label>
            <select class="form-select" ${isReadonly ? 'disabled' : ''}>
                <option>${sceneDisplay}</option>
                ${appData.assets.scenes.filter(s => !currentShot.scenes.includes(s.id)).map(s => `<option>${s.name}</option>`).join('')}
            </select>
        </div>
    `;

    // 道具绑定
    form.innerHTML += `
        <div class="form-group">
            <label class="form-label">🎁 道具绑定</label>
            <div class="form-checkbox-group">
                ${appData.assets.props.map((p, i) => `
                    <label class="form-checkbox-item">
                        <input type="checkbox" ${currentShot.props.includes(p.id) ? 'checked' : ''} ${isReadonly ? 'disabled' : ''}>
                        <span>${p.name}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `;

    // 风格绑定
    const styleDisplay = currentShot.style 
        ? appData.assets.styles.find(s => s.id === currentShot.style)?.name || '选择风格...'
        : '选择风格...';
    form.innerHTML += `
        <div class="form-group">
            <label class="form-label">🎨 风格绑定</label>
            <select class="form-select" ${isReadonly ? 'disabled' : ''}>
                <option>${styleDisplay}</option>
                ${appData.assets.styles.filter(s => s.id !== currentShot.style).map((s, i) => `
                    <option>${s.name}</option>
                `).join('')}
            </select>
        </div>
    `;

    // 是否参考上一分镜
    form.innerHTML += `
        <div class="form-group">
            <label class="form-checkbox-item">
                <input type="checkbox" ${currentShot.refPrevShot ? 'checked' : ''} ${isReadonly ? 'disabled' : ''}>
                <span>参考上一分镜尾帧</span>
            </label>
        </div>
    `;

    // 情绪强度滑条
    form.innerHTML += `
        <div class="form-group">
            <label class="form-label">😊 情绪强度</label>
            <div class="slider-container">
                <input type="range" class="slider" min="0" max="10" value="${currentShot.emotionalIntensity}" ${isReadonly ? 'disabled' : ''}>
                <span class="slider-value">${currentShot.emotionalIntensity}/10</span>
            </div>
        </div>
    `;

    // 节奏强度滑条
    form.innerHTML += `
        <div class="form-group">
            <label class="form-label">⚡ 节奏强度</label>
            <div class="slider-container">
                <input type="range" class="slider" min="0" max="10" value="${currentShot.rhythmIntensity}" ${isReadonly ? 'disabled' : ''}>
                <span class="slider-value">${currentShot.rhythmIntensity}/10</span>
            </div>
        </div>
    `;

    // 镜头运动
    const motions = ['静态', '缓动', '强运动'];
    form.innerHTML += `
        <div class="form-group">
            <label class="form-label">📹 镜头运动</label>
            <div class="form-radio-group">
                ${motions.map(motion => `
                    <label class="form-radio-item">
                        <input type="radio" name="cameraMotion" value="${motion}" 
                               ${currentShot.cameraMotion === motion ? 'checked' : ''} 
                               ${isReadonly ? 'disabled' : ''}>
                        <span>${motion}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `;

    // 生成或重生成按钮 - 只在当前分镜编辑模式时显示
    if (!isReadonly) {
        const btnText = currentShot.status === 'completed' ? '🔄 重新生成' : '🚀 生成分镜';
        form.innerHTML += `
            <button id="generateBtn" class="btn-generate">${btnText}</button>
        `;

        // 添加生成按钮事件
        setTimeout(() => {
            const genBtn = document.getElementById('generateBtn');
            if (genBtn) {
                genBtn.addEventListener('click', () => {
                    generateShot(currentShot);
                });
            }
        }, 0);
    }

    // 添加滑条变化事件
    setTimeout(() => {
        const sliders = document.querySelectorAll('input[type="range"]');
        sliders.forEach(slider => {
            slider.addEventListener('input', (e) => {
                e.target.nextElementSibling.textContent = e.target.value + '/10';
            });
        });
    }, 0);

    // 添加叙事阶段改变事件 - 实时保存到后端
    setTimeout(() => {
        const narrativeRadios = document.querySelectorAll('input[name="narrativeStage"]');
        narrativeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (!isReadonly) {
                    // 立即保存叙事阶段改变
                    currentShot.narrative_stage = e.target.value;
                    DataManager.updateShot(appData.currentShotId, {
                        narrative_stage: e.target.value
                    });
                    console.log('✅ 叙事阶段已更新:', e.target.value);
                    
                    // 刷新关联页面
                    renderOverviewPage();
                }
            });
        });
    }, 0);
}

function renderPreview() {
    const currentShot = DataManager.getShot(appData.currentShotId);
    if (!currentShot) return;

    const previewArea = document.getElementById('previewArea');
    const versionHistory = document.getElementById('versionHistory');
    const regenBtn = document.getElementById('regenBtn');

    // 检查是否有版本历史
    const hasVersions = currentShot.versions && currentShot.versions.length > 0;

    if (hasVersions) {
        // 有版本 - 显示生成内容和版本历史
        const latestVersion = currentShot.versions[0];
        previewArea.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
                <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">已生成 ${latestVersion.version}</div>
            </div>
        `;

        versionHistory.innerHTML = currentShot.versions
            .map(v => `
                <div class="version-item">
                    <span class="version-tag">${v.version}</span>
                    <span>${getStatusLabel(v.status)}</span>
                </div>
            `)
            .join('');
    } else {
        // 无版本 - 显示待生成
        previewArea.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: 12px;">⏳</div>
                <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">待配置和生成</div>
            </div>
        `;

        versionHistory.innerHTML = '<p class="placeholder-text">暂无版本</p>';
    }

    regenBtn.style.display = 'none';
}

// ============ 生成与修改逻辑 ============
function generateShot(shot) {
    // 先保存当前表单数据
    saveChanges(shot);
    
    // 检测一致性
    const consistencyIssue = checkConsistency(shot);
    if (consistencyIssue) {
        showConsistencyModal(consistencyIssue);
        return;
    }

    // 显示加载模态框
    document.getElementById('loadingModal').style.display = 'flex';

    // 模拟生成过程（2-3秒）
    setTimeout(() => {
        document.getElementById('loadingModal').style.display = 'none';
        
        // 显示生成结果
        showGenerationResult(shot);
    }, 2500);
}


function showGenerationResult(shot) {
    // 获取最新的分镜数据
    const currentShot = DataManager.getShot(shot.shotId);
    if (!currentShot) return;
    
    const timestamp = new Date().toISOString();
    
    // 计算新版本号
    let newVersionNumber = 'v1.0';
    if (currentShot.versions && currentShot.versions.length > 0) {
        const latestVersion = currentShot.versions[0];
        const versionMatch = latestVersion.version.match(/v(\d+)\.(\d+)/);
        if (versionMatch) {
            let major = parseInt(versionMatch[1]);
            let minor = parseInt(versionMatch[2]);
            minor++;
            newVersionNumber = `v${major}.${minor}`;
        }
    }
    
    // 创建新版本对象
    const newVersion = {
        version: newVersionNumber,
        status: 'generated',
        timestamp: timestamp
    };
    
    // 将新版本添加到版本历史（放在最前面）
    const updatedVersions = [newVersion, ...(currentShot.versions || [])];
    
    // 更新分镜状态
    DataManager.updateShot(shot.shotId, {
        isGenerated: true,
        status: 'completed',
        versions: updatedVersions,
        lastModified: timestamp
    });

    const versionHistory = document.getElementById('versionHistory');
    
    const resultHTML = `
        <div class="generation-result">
            <div class="result-summary">
                <strong>✅ 生成成功！</strong><br>
                AI 已基于配置的参数和资产生成了此分镜。
            </div>
            <div class="result-metadata">
                <div class="metadata-item">
                    <span>版本号:</span>
                    <span class="metadata-value">${newVersionNumber}</span>
                </div>
                <div class="metadata-item">
                    <span>生成时间:</span>
                    <span class="metadata-value">${new Date().toLocaleTimeString('zh-CN')}</span>
                </div>
                <div class="metadata-item">
                    <span>角色:</span>
                    <span class="metadata-value">林晓雨, 徐晗</span>
                </div>
                <div class="metadata-item">
                    <span>场景:</span>
                    <span class="metadata-value">咖啡馆内景</span>
                </div>
                <div class="metadata-item">
                    <span>风格:</span>
                    <span class="metadata-value">暖色电影感</span>
                </div>
            </div>
        </div>
    `;

    versionHistory.innerHTML = resultHTML;
}

// ============ 一致性检测 ============
function checkConsistency(currentShot) {
    const shots = DataManager.getAllShots();
    const shotIndex = shots.findIndex(s => s.shotId === currentShot.shotId);
    
    if (shotIndex === 0) {
        return null; // 第一个分镜不需要检测
    }

    return null;
}

function getCharacterName(charId) {
    const char = appData.assets.characters.find(c => c.id === charId);
    return char ? char.name : charId;
}

function showConsistencyModal(issue) {
    document.getElementById('consistencyMessage').textContent = issue.message;
    document.getElementById('consistencyModal').style.display = 'flex';
}

function closeConsistencyModal() {
    document.getElementById('consistencyModal').style.display = 'none';
}

// ============ 工具函数 ============
function getNarrativeStageLabel(stage) {
    const labels = {
        '铺垫': '🎬 铺垫',
        '推进': '⚡ 推进',
        '转折': '🔄 转折',
        '高潮': '🎯 高潮',
        '收束': '🎬 收束'
    };
    return labels[stage] || stage;
}

function getStatusLabel(status) {
    const labels = {
        'generated': '✓ 已生成',
        'pending': '⏳ 待生成'
    };
    return labels[status] || status;
}

// ============ 数据导出 & 诊断工具 ============

/**
 * 导出项目数据为JSON字符串 - 用于检查数据结构
 */
function exportProjectData() {
    const data = DataManager.exportJSON();
    console.log('📦 项目数据：\n' + data);
    return JSON.parse(data);
}

/**
 * 查看localStorage中保存的项目数据
 */
function viewLocalstorage() {
    const stored = localStorage.getItem(DataManager.STORAGE_KEY);
    if (stored) {
        console.log('💾 localStorage 中的数据：', JSON.parse(stored));
    } else {
        console.log('⚠️  localStorage 中没有项目数据');
    }
}

/**
 * 清除localStorage中的项目数据（重置应用）
 */
function clearProjectData() {
    localStorage.removeItem(DataManager.STORAGE_KEY);
    console.log('🗑️  已清除 localStorage 中的项目数据');
}

/**
 * 查看特定分镜的详细信息
 * @param {string} shotId - 分镜ID，如 'shot_001'
 */
function viewShot(shotId = appData.currentShotId) {
    const shot = DataManager.getShot(shotId);
    if (shot) {
        console.log(`📌 分镜 ${shotId}:`, shot);
    } else {
        console.log(`❌ 未找到分镜 ${shotId}`);
    }
}

/**
 * 查看所有分镜概览
 */
function listAllShots() {
    const shots = DataManager.getAllShots();
    console.log('📋 所有分镜：');
    shots.forEach((shot, index) => {
        console.log(`  ${index + 1}. ${shot.shotId} - "${shot.title}" [${shot.status}]`);
    });
}

// ============ 调试工具 ============
function logAppState() {
    console.log('📊 当前应用状态：', appData);
}

// 在控制台输出可用命令
console.log(`
╔════════════════════════════════════════╗
║   AI 视频生成工作台 - 调试工具         ║
╚════════════════════════════════════════╝

可用命令：
- logAppState()              查看应用状态
- switchPage('overview')     切换到项目总览
- switchPage('assets')       切换到资产库
- switchPage('control')      切换到分镜控制

数据诊断：
- exportProjectData()        导出项目完整数据
- viewLocalstorage()         查看 localStorage 中的数据
- viewShot('shot_001')       查看特定分镜数据
- listAllShots()             列出所有分镜
- clearProjectData()         清除所有本地数据

🎯 演示功能：
1. 点击侧边栏导航切换页面
2. 在项目总览查看分镜列表
3. 在分镜控制配置参数并生成
4. 在资产库管理可复用资产
`);
