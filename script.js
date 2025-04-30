// 数据库配置
const DB_NAME = "GameRecordDB";
const DB_VERSION = 1;
const STORE_NAME = "games";

// DOM 元素
const addGameBtn = document.getElementById("addGameBtn");
const addGameModal = document.getElementById("addGameModal");
const addGameForm = document.getElementById("addGameForm");
const gameGrid = document.querySelector(".game-grid");
const yearFilter = document.getElementById("yearFilter");
const platformFilter = document.getElementById("platformFilter");

// 初始化数据库
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };
    });
}

// 获取数据库连接
async function getDB() {
    try {
        return await initDB();
    } catch (error) {
        console.error("数据库连接失败:", error);
        showError("数据库连接失败，请刷新页面重试");
        throw error;
    }
}

// 获取游戏数据
async function getGames() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

// 保存游戏数据
async function saveGames(games) {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    // 清空现有数据
    await new Promise((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onerror = () => reject(clearRequest.error);
        clearRequest.onsuccess = () => resolve();
    });

    // 添加新数据
    for (const game of games) {
        await new Promise((resolve, reject) => {
            const addRequest = store.add(game);
            addRequest.onerror = () => reject(addRequest.error);
            addRequest.onsuccess = () => resolve();
        });
    }
}

// 压缩图片
async function compressImage(base64String) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64String;
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            // 设置压缩后的最大尺寸
            const maxWidth = 800;
            const maxHeight = 600;

            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL()); // 使用原始图片格式
        };
    });
}

// 显示添加游戏的模态框
addGameBtn.addEventListener("click", () => {
    addGameModal.classList.add("active");
});

// 关闭模态框
addGameModal.querySelector(".cancel-btn").addEventListener("click", () => {
    addGameModal.classList.remove("active");
    addGameForm.reset();
});

// 显示加载状态
function showLoading(message) {
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "loading-overlay";
    loadingDiv.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-message">${message}</div>
    `;
    document.body.appendChild(loadingDiv);
}

// 隐藏加载状态
function hideLoading() {
    const loadingDiv = document.querySelector(".loading-overlay");
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

// 显示错误提示
function showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
}

// 添加评分滑动条的实时显示功能
const ratingSlider = document.getElementById("rating");
const ratingValue = document.getElementById("ratingValue");
const editRatingSlider = document.getElementById("editRating");
const editRatingValue = document.getElementById("editRatingValue");

if (ratingSlider) {
    ratingSlider.addEventListener("input", function () {
        ratingValue.textContent = this.value;
    });
}

if (editRatingSlider) {
    editRatingSlider.addEventListener("input", function () {
        editRatingValue.textContent = this.value;
    });
}

// 添加新游戏
addGameForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const coverFile = document.getElementById("gameCover").files[0];
    if (!coverFile) {
        showError("请选择游戏封面图片");
        return;
    }

    showLoading("正在保存游戏记录...");

    try {
        // 将图片转换为Base64
        const reader = new FileReader();
        const coverBase64 = await new Promise((resolve) => {
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(coverFile);
        });

        // 压缩图片
        const compressedCover = await compressImage(coverBase64);

        const newGame = {
            id: Date.now(),
            title: document.getElementById("gameTitle").value,
            cover: compressedCover,
            playDate: document.getElementById("playDate").value,
            releaseDate: document.getElementById("releaseDate").value,
            platform: document.getElementById("platform").value,
            ratings: {
                overall: parseInt(document.getElementById("ratingOverall").value),
                gameplay: parseInt(document.getElementById("ratingGameplay").value),
                story: parseInt(document.getElementById("ratingStory").value),
                graphics: parseInt(document.getElementById("ratingGraphics").value),
                music: parseInt(document.getElementById("ratingMusic").value),
            },
            review: document.getElementById("review").value,
        };

        const games = await getGames();
        games.push(newGame);
        await saveGames(games);

        addGameModal.classList.remove("active");
        addGameForm.reset();
        await updateGameList();
        await updateFilters();
    } catch (error) {
        console.error("保存游戏记录失败:", error);
        showError("保存游戏记录失败，请重试");
    } finally {
        hideLoading();
    }
});

// 删除游戏
async function deleteGame(gameId, event) {
    event.stopPropagation();
    if (confirm("确定要删除这个游戏记录吗？")) {
        try {
            const games = await getGames();
            const updatedGames = games.filter((game) => game.id !== gameId);
            await saveGames(updatedGames);
            await updateGameList();
            await updateFilters();
        } catch (error) {
            console.error("删除游戏记录失败:", error);
            showError("删除游戏记录失败，请重试");
        }
    }
}

// 创建游戏卡片
function createGameCard(game) {
    const card = document.createElement("div");
    card.className = "game-card";
    const totalRating = calculateWeightedRating(game.ratings);
    const starsHTML = generateStars(totalRating);

    card.innerHTML = `
        <button class="delete-btn" title="删除游戏">X</button>
        <img loading="lazy" src="${game.cover}" alt="${game.title}" class="game-cover">
        <div class="game-info">
            <h3 class="game-title">${game.title}</h3>
            <div class="game-details">
                <p>发售日期：${new Date(game.releaseDate).toLocaleDateString()}</p>
                <p>游玩平台：${game.platform}</p>
                <p>通关日期：${game.playDate ? new Date(game.playDate).toLocaleDateString() : "过往游戏"}</p>
            </div>
            <div class="game-rating">评分：${starsHTML} (${totalRating.toFixed(1)})</div>
        </div>
    `;

    // 添加删除按钮事件
    card
        .querySelector(".delete-btn")
        .addEventListener("click", (e) => deleteGame(game.id, e));

    // 点击卡片显示游戏详情
    card.addEventListener("click", () => showGameDetails(game));

    return card;
}

// 显示游戏详情
function showGameDetails(game) {
    const modal = document.getElementById("gameDetailsModal");
    const closeBtn = modal.querySelector(".close-btn");
    const editBtn = modal.querySelector(".edit-btn");

    // 填充详情内容
    document.getElementById("detailsCover").src = game.cover;
    document.getElementById("detailsTitle").textContent = game.title;
    const totalRating = calculateWeightedRating(game.ratings);
    document.getElementById("detailsInfo").innerHTML = `
        <p>发售日期：${new Date(game.releaseDate).toLocaleDateString()}</p>
        <p>游玩平台：${game.platform}</p>
        <p>通关日期：${game.playDate ? new Date(game.playDate).toLocaleDateString() : '未通关'}</p>
        <div class="detailed-ratings">
            <p>总体印象：${generateStars(game.ratings?.overall || 0)} (${game.ratings?.overall || 0})</p>
            <p>玩法：${generateStars(game.ratings?.gameplay || 0)} (${game.ratings?.gameplay || 0})</p>
            <p>剧情：${generateStars(game.ratings?.story || 0)} (${game.ratings?.story || 0})</p>
            <p>画面：${generateStars(game.ratings?.graphics || 0)} (${game.ratings?.graphics || 0})</p>
            <p>音乐：${generateStars(game.ratings?.music || 0)} (${game.ratings?.music || 0})</p>
            <hr>
            <p><strong>总评分：${generateStars(totalRating)} (${totalRating.toFixed(1)})</strong></p>
        </div>
    `;
    document.getElementById("detailsReview").textContent = game.review;

    // 显示模态框
    modal.classList.add("active");

    // 编辑按钮事件
    editBtn.onclick = () => {
        showEditForm(game); // Pass the full game object
        modal.classList.remove("active");
    };

    // 关闭按钮事件
    const closeModal = () => {
        modal.classList.remove("active");
        closeBtn.removeEventListener("click", closeModal);
    };

    closeBtn.addEventListener("click", closeModal);
}

// 更新游戏列表显示
async function updateGameList() {
    try {
        const games = await getGames();
        const selectedYear = yearFilter.value;
        const selectedPlatform = platformFilter.value;

        // 获取复选框状态
        const showUnfinished = document.getElementById("showUnfinishedGames").checked;

        // 筛选游戏
        const filteredGames = games.filter((game) => {
            const gameYear = game.playDate ? new Date(game.playDate).getFullYear().toString() : null;
            const yearMatch = selectedYear === "all" || (gameYear && gameYear === selectedYear);
            const platformMatch = selectedPlatform === "all" || game.platform === selectedPlatform;
            const finishMatch = showUnfinished || game.playDate;
            return yearMatch && platformMatch && finishMatch;
        });

        // 获取评分排序方式
        const ratingSort = document.getElementById("ratingSort").value;

        // 排序游戏列表
        filteredGames.sort((a, b) => {
            // 计算加权评分用于排序
            const ratingA = calculateWeightedRating(a.ratings);
            const ratingB = calculateWeightedRating(b.ratings);

            // 按照加权评分排序
            if (ratingSort === "desc") {
                return ratingB - ratingA;
            } else if (ratingSort === "asc") {
                return ratingA - ratingB;
            }
            return 0; // 如果不需要评分排序，则保持原始顺序或按其他标准排序
        });

        // 清空并重新填充游戏网格
        gameGrid.innerHTML = "";
        filteredGames.forEach((game) => {
            gameGrid.appendChild(createGameCard(game));
        });
    } catch (error) {
        console.error("更新游戏列表失败:", error);
    }
}

// 更新筛选器选项
async function updateFilters() {
    try {
        const games = await getGames();
        const years = new Set();
        const platforms = new Set();

        games.forEach((game) => {
            if (game.playDate) {
                years.add(new Date(game.playDate).getFullYear().toString());
            }
            platforms.add(game.platform);
        });

        // 更新年份筛选器
        const currentYearOption = yearFilter.value;
        yearFilter.innerHTML = '<option value="all">全部年份</option>';
        Array.from(years)
            .sort()
            .reverse()
            .forEach((year) => {
                yearFilter.innerHTML += `<option value="${year}" ${year === currentYearOption ? "selected" : ""
                    }>${year}年</option>`;
            });

        // 更新平台筛选器
        const currentPlatformOption = platformFilter.value;
        platformFilter.innerHTML = '<option value="all">全部平台</option>';
        Array.from(platforms)
            .sort()
            .forEach((platform) => {
                platformFilter.innerHTML += `<option value="${platform}" ${platform === currentPlatformOption ? "selected" : ""
                    }>${platform}</option>`;
            });
    } catch (error) {
        console.error("更新筛选器失败:", error);
    }
}

// 监听筛选器变化
yearFilter.addEventListener("change", updateGameList);
platformFilter.addEventListener("change", updateGameList);
document.getElementById("ratingSort").addEventListener("change", updateGameList);
document.getElementById("showUnfinishedGames").addEventListener("change", updateGameList);

// 显示编辑表单
function showEditForm(game) {
    const editModal = document.getElementById("editGameModal");
    const editForm = document.getElementById("editGameForm");

    // 填充表单数据
    document.getElementById("editGameId").value = game.id;
    document.getElementById("editGameTitle").value = game.title;
    document.getElementById("editPlayDate").value = game.playDate;
    document.getElementById("editReleaseDate").value = game.releaseDate;
    document.getElementById("editPlatform").value = game.platform;
    // Populate the individual rating selects
    document.getElementById("editRatingOverall").value = game.ratings?.overall || 5;
    document.getElementById("editRatingGameplay").value = game.ratings?.gameplay || 5;
    document.getElementById("editRatingStory").value = game.ratings?.story || 5;
    document.getElementById("editRatingGraphics").value = game.ratings?.graphics || 5;
    document.getElementById("editRatingMusic").value = game.ratings?.music || 5;
    document.getElementById("editReview").value = game.review;

    // 显示模态框
    editModal.classList.add("active");

    // 取消按钮事件
    editModal.querySelector(".cancel-btn").onclick = () => {
        editModal.classList.remove("active");
        editForm.reset();
    };

    // 表单提交事件
    editForm.onsubmit = async (e) => {
        e.preventDefault();

        showLoading("正在更新游戏记录...");

        try {
            const games = await getGames();
            const gameIndex = games.findIndex((g) => g.id === game.id);

            if (gameIndex === -1) return;

            // 更新游戏数据
            const updatedGame = {
                ...game,
                title: document.getElementById("editGameTitle").value,
                playDate: document.getElementById("editPlayDate").value,
                releaseDate: document.getElementById("editReleaseDate").value,
                platform: document.getElementById("editPlatform").value,
                ratings: {
                    overall: parseInt(document.getElementById("editRatingOverall").value),
                    gameplay: parseInt(document.getElementById("editRatingGameplay").value),
                    story: parseInt(document.getElementById("editRatingStory").value),
                    graphics: parseInt(document.getElementById("editRatingGraphics").value),
                    music: parseInt(document.getElementById("editRatingMusic").value),
                },
                review: document.getElementById("editReview").value,
            };

            // 处理封面图片
            const coverFile = document.getElementById("editGameCover").files[0];
            if (coverFile) {
                const reader = new FileReader();
                const coverBase64 = await new Promise((resolve) => {
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(coverFile);
                });

                // 压缩图片
                updatedGame.cover = await compressImage(coverBase64);
            }

            games[gameIndex] = updatedGame;
            await saveGames(games);

            editModal.classList.remove("active");
            editForm.reset();
            await updateGameList();
            await updateFilters();
        } catch (error) {
            console.error("更新游戏记录失败:", error);
            showError("更新游戏记录失败，请重试");
        } finally {
            hideLoading();
        }
    };
}

// 导出数据备份
async function exportData() {
    try {
        showLoading("正在导出数据...");
        const games = await getGames();
        // Ensure ratings are properly stringified if they exist
        const dataStr = JSON.stringify(games, (key, value) => {
            // Handle potential issues with complex objects if needed
            return value;
        });
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `游戏记录备份_${new Date().toLocaleDateString()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showError("数据导出成功");
    } catch (error) {
        console.error("导出数据失败:", error);
        showError("导出数据失败，请重试");
    } finally {
        hideLoading();
    }
}

// 导入数据备份
async function importData(file) {
    try {
        showLoading("正在导入数据...");
        const text = await file.text();
        const games = JSON.parse(text);
        // Basic validation or migration logic could be added here
        // to handle older data formats without the 'ratings' object
        const validatedGames = games.map(game => {
            if (!game.ratings && game.rating) { // Simple migration for old format
                console.warn(`Migrating old rating format for game: ${game.title}`);
                // Assign a default structure or try to infer from old rating
                // This is a basic example, might need more sophisticated logic
                const defaultRating = Math.round(Math.min(Math.max(parseFloat(game.rating) / 2, 0), 5)); // Convert 0-10 to 0-5
                return {
                    ...game,
                    ratings: {
                        overall: defaultRating,
                        gameplay: defaultRating,
                        story: defaultRating,
                        graphics: defaultRating,
                        music: defaultRating
                    },
                    rating: undefined // Remove old rating field
                };
            } else if (!game.ratings) {
                console.warn(`Game missing ratings object: ${game.title}`);
                // Provide a default ratings object if missing entirely
                return {
                    ...game,
                    ratings: { overall: 3, gameplay: 3, story: 3, graphics: 3, music: 3 }
                };
            }
            return game;
        });
        await saveGames(validatedGames);
        await updateGameList();
        await updateFilters();
        showError("数据导入成功");
    } catch (error) {
        console.error("导入数据失败:", error);
        showError("导入数据失败，请确保文件格式正确或尝试迁移旧数据");
    } finally {
        hideLoading();
    }
}

// 初始化页面
updateGameList();
updateFilters();

// 计算加权平均分 (0-5)
function calculateWeightedRating(ratings) {
    if (!ratings) return 0;
    const weights = {
        overall: 0.3,
        gameplay: 0.3,
        story: 0.2,
        graphics: 0.1,
        music: 0.1,
    };
    let total = 0;
    total += (ratings.overall || 0) * weights.overall;
    total += (ratings.gameplay || 0) * weights.gameplay;
    total += (ratings.story || 0) * weights.story;
    total += (ratings.graphics || 0) * weights.graphics;
    total += (ratings.music || 0) * weights.music;
    // 四舍五入到最近的 0.5
    return Math.round(total * 2) / 2;
}

// 生成星星 HTML
function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    let starsHTML = '';
    for (let i = 0; i < fullStars; i++) starsHTML += '★'; // 实心星
    // 使用 Font Awesome 图标或 Unicode 字符表示半星和空星
    if (halfStar) starsHTML += '<i class="fas fa-star-half-alt"></i>'; // 半星图标
    for (let i = 0; i < emptyStars; i++) starsHTML += '<i class="far fa-star"></i>'; // 空星图标
    // 如果需要纯文本星星，可以使用：
    // if (halfStar) starsHTML += '½';
    // for (let i = 0; i < emptyStars; i++) starsHTML += '☆';
    return `<span class="stars">${starsHTML}</span>`;
}
