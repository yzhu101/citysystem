/**
 * Mental Map 心理地图功能
 * 基于探索历史生成emoji节点的可视化地图
 * 包含底图、点图层、线图层和面图层
 */

class MentalMap {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.nodes = [];
        this.connections = [];
        // 移除areas属性，不再使用面图层
        this.svg = null;
        this.width = 600;
        this.height = 400;
        this.baseMapPath = 'assets/map/base-map.svg'; // 底图路径（使用相对路径）
        this.baseMapLoaded = false;
        
        // 缩放和拖拽相关属性
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.lastTouchX = 0;
        this.lastTouchY = 0;
        this.lastPinchDistance = 0;
        
        if (!this.container) {
            throw new Error(`找不到容器元素: ${containerId}`);
        }
        
        this.init();
    }
    
    init() {
        // 创建SVG容器
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('width', this.width);
        this.svg.setAttribute('height', this.height);
        this.svg.style.cssText = 'border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;';
        
        // 创建图层组
        this.baseMapLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.baseMapLayer.setAttribute('class', 'base-map-layer');
        
        // 创建可缩放和拖拽的内容容器
        this.contentGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.contentGroup.setAttribute('class', 'content-group');
        
        // 移除区域图层（面图层）
        
        this.connectionLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.connectionLayer.setAttribute('class', 'connection-layer');
        
        this.nodeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.nodeLayer.setAttribute('class', 'node-layer');
        
        // 按顺序添加图层（从底到顶）
        this.svg.appendChild(this.baseMapLayer);
        this.contentGroup.appendChild(this.connectionLayer);
        this.contentGroup.appendChild(this.nodeLayer);
        this.svg.appendChild(this.contentGroup);
        
        this.container.appendChild(this.svg);
        
        // 初始化缩放和拖拽功能
        this.initZoomAndPan();
        
        // 尝试加载底图
        this.loadBaseMap();
    }
    
    /**
     * 初始化缩放和拖拽功能
     */
    initZoomAndPan() {
        // 鼠标滚轮缩放
        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            // 获取鼠标在SVG中的位置
            const svgRect = this.svg.getBoundingClientRect();
            const mouseX = e.clientX - svgRect.left;
            const mouseY = e.clientY - svgRect.top;
            
            // 计算缩放比例变化
            const scaleDelta = e.deltaY < 0 ? 1.1 : 0.9;
            const newScale = this.scale * scaleDelta;
            
            // 限制缩放范围
            if (newScale >= 0.5 && newScale <= 3) {
                // 计算新的平移量，保持鼠标位置不变
                this.translateX = mouseX - (mouseX - this.translateX) * scaleDelta;
                this.translateY = mouseY - (mouseY - this.translateY) * scaleDelta;
                this.scale = newScale;
                
                // 应用变换
                this.applyTransform();
            }
        });
        
        // 鼠标拖拽
        this.svg.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // 左键
                this.isDragging = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                this.svg.style.cursor = 'grabbing';
            }
        });
        
        this.svg.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = e.clientX - this.lastMouseX;
                const dy = e.clientY - this.lastMouseY;
                
                this.translateX += dx;
                this.translateY += dy;
                
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                
                this.applyTransform();
            }
        });
        
        this.svg.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.svg.style.cursor = 'grab';
        });
        
        this.svg.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.svg.style.cursor = 'grab';
        });
        
        // 移动端触摸事件
        this.svg.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            if (e.touches.length === 1) {
                // 单指拖拽
                this.isDragging = true;
                this.lastTouchX = e.touches[0].clientX;
                this.lastTouchY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                // 双指缩放 - 记录初始距离
                this.isDragging = false;
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                this.lastPinchDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
            }
        });
        
        this.svg.addEventListener('touchmove', (e) => {
            e.preventDefault();
            
            if (e.touches.length === 1 && this.isDragging) {
                // 单指拖拽
                const touch = e.touches[0];
                const dx = touch.clientX - this.lastTouchX;
                const dy = touch.clientY - this.lastTouchY;
                
                this.translateX += dx;
                this.translateY += dy;
                
                this.lastTouchX = touch.clientX;
                this.lastTouchY = touch.clientY;
                
                this.applyTransform();
            } else if (e.touches.length === 2) {
                // 双指缩放
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
                
                // 计算缩放比例变化
                const scaleDelta = currentDistance / this.lastPinchDistance;
                const newScale = this.scale * scaleDelta;
                
                // 限制缩放范围
                if (newScale >= 0.5 && newScale <= 3) {
                    // 计算缩放中心点
                    const centerX = (touch1.clientX + touch2.clientX) / 2;
                    const centerY = (touch1.clientY + touch2.clientY) / 2;
                    const svgRect = this.svg.getBoundingClientRect();
                    const svgCenterX = centerX - svgRect.left;
                    const svgCenterY = centerY - svgRect.top;
                    
                    // 计算新的平移量，保持缩放中心不变
                    this.translateX = svgCenterX - (svgCenterX - this.translateX) * scaleDelta;
                    this.translateY = svgCenterY - (svgCenterY - this.translateY) * scaleDelta;
                    this.scale = newScale;
                    
                    this.lastPinchDistance = currentDistance;
                    
                    this.applyTransform();
                }
            }
        });
        
        this.svg.addEventListener('touchend', () => {
            this.isDragging = false;
        });
        
        // 设置初始光标样式
        this.svg.style.cursor = 'grab';
    }
    
    /**
     * 应用变换到内容组
     */
    applyTransform() {
        this.contentGroup.setAttribute('transform', `translate(${this.translateX}, ${this.translateY}) scale(${this.scale})`);
    }
    
    /**
     * 加载底图
     */
    loadBaseMap() {
        console.log('开始加载底图:', this.baseMapPath);
        
        // 构建绝对URL路径
        const absolutePath = new URL(this.baseMapPath, window.location.href).href;
        console.log('绝对路径:', absolutePath);
        
        // 直接使用SVG图像元素加载底图
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('width', this.width);
        img.setAttribute('height', this.height);
        img.setAttribute('opacity', '1.0'); // 修改透明度为1.0，显示原始颜色
        img.setAttribute('href', absolutePath);
        
        // 添加加载事件监听
        img.onload = () => {
            console.log('底图加载成功');
            this.baseMapLoaded = true;
        };
        
        img.onerror = (error) => {
            console.error('底图加载失败:', error);
            console.error('尝试加载的底图路径:', this.baseMapPath);
            
            // 显示错误信息
            const errorText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            errorText.setAttribute('x', this.width / 2);
            errorText.setAttribute('y', 20);
            errorText.setAttribute('text-anchor', 'middle');
            errorText.setAttribute('fill', '#ff0000');
            errorText.setAttribute('font-size', '12');
            errorText.textContent = `底图加载失败: ${this.baseMapPath}`;
            
            // 底图加载失败时使用默认背景
            const defaultBackground = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            defaultBackground.setAttribute('width', this.width);
            defaultBackground.setAttribute('height', this.height);
            defaultBackground.setAttribute('fill', '#f9f9f9');
            defaultBackground.setAttribute('stroke', '#ddd');
            defaultBackground.setAttribute('stroke-width', '1');
            
            this.baseMapLayer.appendChild(defaultBackground);
            this.baseMapLayer.appendChild(errorText);
        };
        
        // 添加到底图图层
        this.baseMapLayer.appendChild(img);
        console.log('底图元素已添加');
    }
    
    /**
     * 调用DeepSeek API分析卡片内容并生成emoji和短语注释
     */
    async analyzeCardWithDeepSeek(cardContent) {
        try {
            const prompt = `请分析以下城市探索卡片内容，为其选择一个最合适的emoji表情符号，并用一个短语（6个字以内）总结该卡片内容。要求：
1. emoji要能准确反映卡片的主要内容或情感
2. 短语要简洁有力地概括卡片的核心内容或感受
3. 回答格式为JSON：{"emoji":"🌳", "phrase":"城市绿洲"}
4. 优先选择与城市、探索、观察、行动相关的emoji

卡片内容：${cardContent}`;
            
            const response = await fetch(window._0x9e2a, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window._0x8c4d}`
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [{
                        role: "user",
                        content: prompt
                    }],
                    max_tokens: 50
                })
            });
            
            if (!response.ok) {
                throw new Error(`API请求失败: ${response.statusText}`);
            }
            
            const data = await response.json();
            const resultText = data.choices[0].message.content.trim();
            
            // 尝试解析JSON结果
            let result = { emoji: '📍', phrase: '探索记录' };
            try {
                // 提取JSON部分（可能包含在代码块或其他文本中）
                const jsonMatch = resultText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsedResult = JSON.parse(jsonMatch[0]);
                    // 验证返回的emoji是否有效
                    if (parsedResult.emoji && parsedResult.emoji.length <= 4) {
                        result.emoji = parsedResult.emoji;
                    }
                    // 验证短语是否有效
                    if (parsedResult.phrase && parsedResult.phrase.length <= 6) {
                        result.phrase = parsedResult.phrase;
                    }
                }
            } catch (e) {
                console.error('解析卡片分析结果失败:', e);
                // 使用默认值
            }
            
            return result;
        } catch (error) {
            console.error('分析卡片内容失败:', error);
            return { emoji: '📍', phrase: '探索记录' }; // 默认值
        }
    }
    
    /**
     * 从探索历史生成心理地图
     */
    async generateFromHistory() {
        try {
            // 获取探索历史
            const historyItems = document.querySelectorAll('.history-item');
            if (historyItems.length === 0) {
                throw new Error('没有找到探索历史');
            }
            
            // 显示加载状态
            this.showLoading('正在分析探索历史...');
            
            // 清空现有节点和区域
            this.nodes = [];
            this.connections = [];
            this.areas = [];
            
            // 收集所有卡片内容用于后续分析
            const allContents = [];
            
            // 为每个历史项目生成emoji节点
            for (let i = 0; i < historyItems.length; i++) {
                const item = historyItems[i];
                const content = item.textContent.replace(/^#\d+\s*-\s*/, '');
                allContents.push(content);
                
                // 调用DeepSeek分析内容，获取emoji和短语注释
                const result = await this.analyzeCardWithDeepSeek(content);
                
                // 创建节点
                const node = {
                    id: i,
                    emoji: result.emoji,
                    phrase: result.phrase, // 添加短语注释
                    content: content,
                    x: 0,
                    y: 0
                };
                
                this.nodes.push(node);
                
                // 更新加载状态
                this.updateLoadingText(`正在分析第 ${i + 1}/${historyItems.length} 张卡片...`);
            }
            
            // 生成连接关系（按时间顺序连接）
            for (let i = 0; i < this.nodes.length - 1; i++) {
                this.connections.push({
                    source: i,
                    target: i + 1
                });
            }
            
            // 计算节点位置
            this.calculateNodePositions();
            
            // 不再分析区域（面图层已移除）
            this.updateLoadingText('准备渲染地图...');
            
            // 渲染地图
            this.render();
            
            // 隐藏加载状态
            this.hideLoading();
            
        } catch (error) {
            console.error('生成心理地图失败:', error);
            this.hideLoading();
            this.showError('生成心理地图失败: ' + error.message);
        }
    }
    
    /**
     * 分析卡片内容相似性并生成区域 - 已移除
     */
    async analyzeAreas(contents) {
        // 此方法已被移除，保留空函数以避免引用错误
        return { name: "探索区域", description: "你的探索轨迹" };
    }
    
    /**
     * 计算节点位置 - 改进的力导向布局
     */
    calculateNodePositions() {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        if (this.nodes.length === 1) {
            this.nodes[0].x = centerX;
            this.nodes[0].y = centerY;
            return;
        }
        
        // 初始化节点位置 - 使用更大半径的环形布局作为起点
        this.nodes.forEach((node, index) => {
            // 计算环形布局的初始位置
            const angle = (index / this.nodes.length) * 2 * Math.PI;
            // 增加初始半径，使节点分布更分散
            const radius = Math.min(this.width, this.height) * 0.45;
            
            // 添加更多随机性，使环形不那么规则
            const randomRadius = radius * (0.8 + Math.random() * 0.5);
            
            node.x = centerX + randomRadius * Math.cos(angle);
            node.y = centerY + randomRadius * Math.sin(angle);
        });
        
        // 应用改进的力导向布局算法
        // 模拟物理力的作用，让节点分布更自然且更分散
        const iterations = 100; // 增加迭代次数以获得更好的布局
        const k = 15; // 降低弹簧系数，使连接线可以更长
        const repulsion = 1500; // 增加排斥力系数，使节点间距更大
        
        for (let iter = 0; iter < iterations; iter++) {
            // 每个节点受到的合力
            const forces = this.nodes.map(() => ({ x: 0, y: 0 }));
            
            // 计算节点间的排斥力（所有节点之间）
            for (let i = 0; i < this.nodes.length; i++) {
                for (let j = i + 1; j < this.nodes.length; j++) {
                    const nodeA = this.nodes[i];
                    const nodeB = this.nodes[j];
                    
                    const dx = nodeB.x - nodeA.x;
                    const dy = nodeB.y - nodeA.y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                    
                    // 增强近距离排斥力，使节点不会过于靠近
                    let force;
                    if (distance < 120) { // 增加近距离阈值
                        // 近距离时使用更强的排斥力
                        force = repulsion * 3 / (distance * distance); // 增强近距离排斥
                    } else {
                        // 正常排斥力
                        force = repulsion / (distance * distance);
                    }
                    
                    // 归一化方向向量
                    const unitX = dx / distance;
                    const unitY = dy / distance;
                    
                    // 施加排斥力
                    forces[i].x -= unitX * force;
                    forces[i].y -= unitY * force;
                    forces[j].x += unitX * force;
                    forces[j].y += unitY * force;
                }
            }
            
            // 计算连接线的弹簧力（仅相连节点之间）
            this.connections.forEach(conn => {
                const sourceNode = this.nodes[conn.source];
                const targetNode = this.nodes[conn.target];
                
                const dx = targetNode.x - sourceNode.x;
                const dy = targetNode.y - sourceNode.y;
                const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                
                // 增加理想距离，使连接的节点之间有更大间距
                const idealDistance = 130; // 增加理想距离
                
                // 弹簧力与距离差成正比
                const force = k * (distance - idealDistance);
                
                // 归一化方向向量
                const unitX = dx / distance;
                const unitY = dy / distance;
                
                // 施加弹簧力
                forces[conn.source].x += unitX * force;
                forces[conn.source].y += unitY * force;
                forces[conn.target].x -= unitX * force;
                forces[conn.target].y -= unitY * force;
            });
            
            // 添加向画布中心的微弱引力，防止节点过度分散
            this.nodes.forEach((node, i) => {
                const dx = centerX - node.x;
                const dy = centerY - node.y;
                const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                
                if (distance > this.width * 0.45) { // 增加中心引力触发距离
                    const gravityForce = distance * 0.008; // 调整中心引力
                    forces[i].x += (dx / distance) * gravityForce;
                    forces[i].y += (dy / distance) * gravityForce;
                }
            });
            
            // 应用力，更新节点位置
            this.nodes.forEach((node, i) => {
                // 力的衰减因子，随着迭代次数增加而减小
                const dampingFactor = 1 - (iter / iterations);
                
                // 更新位置，减小力的影响以避免过度调整
                node.x += forces[i].x * 0.04 * dampingFactor; // 减小力的影响
                node.y += forces[i].y * 0.04 * dampingFactor;
                
                // 确保节点不会移出画布
                const padding = 70; // 增加边距
                node.x = Math.max(padding, Math.min(this.width - padding, node.x));
                node.y = Math.max(padding, Math.min(this.height - padding, node.y));
            });
        }
        
        // 最后添加一些随机性，使布局更自然
        this.nodes.forEach(node => {
            const jitter = 20; // 增加随机偏移
            node.x += (Math.random() - 0.5) * jitter;
            node.y += (Math.random() - 0.5) * jitter;
        });
    }
    
    /**
     * 渲染心理地图
     */
    render() {
        // 清空各图层
        this.baseMapLayer.innerHTML = '';
        this.connectionLayer.innerHTML = '';
        this.nodeLayer.innerHTML = '';
        
        // 重新加载底图
        this.baseMapLoaded = false;
        this.loadBaseMap();
        
        // 渲染连接线（线图层）
        this.renderConnections();
        
        // 渲染节点（点图层）
        this.renderNodes();
    }
    
    /**
     * 渲染区域（面图层）- 已移除
     */
    renderAreas() {
        // 此方法已被移除，保留空函数以避免引用错误
        return;
    }
    
    /**
     * 渲染连接线（线图层）- 改进的地铁线路风格
     */
    renderConnections() {
        // 地铁线路颜色数组 - 使用用户指定的配色
        const lineColors = ['#E9CB70', '#EC6E5F', '#577A8F', '#B7B4AC', '#E9CB70', '#EC6E5F', '#577A8F', '#B7B4AC'];
        
        // 为每条连接分配一个颜色（按顺序循环使用颜色）
        let currentColorIndex = 0;
        let currentLineId = 0;
        let lastSource = -1;
        
        this.connections.forEach(conn => {
            const sourceNode = this.nodes[conn.source];
            const targetNode = this.nodes[conn.target];
            
            // 如果是新的起点，切换到新的线路颜色
            if (conn.source !== lastSource && lastSource !== -1) {
                currentColorIndex = (currentColorIndex + 1) % lineColors.length;
                currentLineId++;
            }
            
            // 获取当前线路颜色
            const lineColor = lineColors[currentColorIndex];
            
            // 创建路径而不是直线，以便添加曲线效果
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            
            // 计算控制点（使用贝塞尔曲线创建平滑路径）
            // 计算两点之间的距离
            const dx = targetNode.x - sourceNode.x;
            const dy = targetNode.y - sourceNode.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 根据距离计算控制点偏移量
            const offset = Math.min(distance * 0.3, 50);
            
            // 计算控制点位置（垂直于连接线方向）
            const midX = (sourceNode.x + targetNode.x) / 2;
            const midY = (sourceNode.y + targetNode.y) / 2;
            
            // 计算垂直于连接线的方向向量
            const perpX = -dy / distance;
            const perpY = dx / distance;
            
            // 根据线路ID决定控制点的偏移方向（交替上下或左右）
            const controlX = midX + perpX * offset * (currentLineId % 2 === 0 ? 1 : -1);
            const controlY = midY + perpY * offset * (currentLineId % 2 === 0 ? 1 : -1);
            
            // 使用二次贝塞尔曲线创建平滑路径
            const pathData = `M ${sourceNode.x} ${sourceNode.y} Q ${controlX} ${controlY}, ${targetNode.x} ${targetNode.y}`;
            
            path.setAttribute('d', pathData);
            path.setAttribute('stroke', lineColor);
            path.setAttribute('stroke-width', '4');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');
            path.setAttribute('data-line-id', currentLineId);
            
            // 添加虚线效果（可选）
            if (currentLineId % 2 === 1) {
                path.setAttribute('stroke-dasharray', '8 4');
            }
            
            this.connectionLayer.appendChild(path);
            lastSource = conn.source;
        });
    }
    
    /**
     * 渲染节点（点图层）- 地铁站点风格
     */
    renderNodes() {
        // 站点颜色已简化为单一样式
        // 使用 #F5F1E6 作为填充色，#252525 作为边框色
        
        this.nodes.forEach((node, index) => {
            // 创建节点组
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('transform', `translate(${node.x}, ${node.y})`);
            
            // 创建站点圆形 - 简化为单层圆形
            const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            outerCircle.setAttribute('r', '16'); // 保持半径
            outerCircle.setAttribute('fill', '#F5F1E6'); // 使用指定的底色
            outerCircle.setAttribute('stroke', '#252525'); // 使用指定的边框颜色
            outerCircle.setAttribute('stroke-width', '3'); // 保持边框宽度
            
            // 创建emoji文本（作为站点图标）- 增大字体
            const emojiText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            emojiText.setAttribute('text-anchor', 'middle');
            emojiText.setAttribute('dominant-baseline', 'central');
            emojiText.setAttribute('font-size', '14'); // 增大字体
            emojiText.setAttribute('y', '0');
            emojiText.textContent = node.emoji;
            
            // 添加站名标签 - 改进文本显示方式
            const stationName = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            stationName.setAttribute('text-anchor', 'middle');
            stationName.setAttribute('dominant-baseline', 'central');
            stationName.setAttribute('font-size', '14'); // 增大字体
            stationName.setAttribute('fill', '#333');
            stationName.setAttribute('font-weight', 'bold');
            
            // 根据节点索引交替文本位置，避免文字重叠，增加距离
            const textPositions = [
                { x: 0, y: 55 },   // 下方（增加距离）
                { x: 55, y: 0 },   // 右侧（增加距离）
                { x: 0, y: -55 },  // 上方（增加距离）
                { x: -55, y: 0 }   // 左侧（增加距离）
            ];
            
            // 选择位置（根据节点索引循环使用不同位置）
            const position = textPositions[index % textPositions.length];
            stationName.setAttribute('x', position.x);
            stationName.setAttribute('y', position.y);
            
            // 为文本添加更大的背景，提高可读性
            const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            textBg.setAttribute('x', position.x - 45); // 增加宽度
            textBg.setAttribute('y', position.y - 12); // 增加高度
            textBg.setAttribute('width', '90'); // 增加宽度
            textBg.setAttribute('height', '24'); // 增加高度
            textBg.setAttribute('fill', 'rgba(255, 255, 255, 0.92)'); // 增加不透明度
            textBg.setAttribute('rx', '8'); // 增加圆角
            textBg.setAttribute('stroke', '#ccc'); // 添加边框
            textBg.setAttribute('stroke-width', '0.8'); // 边框宽度
            
            // 使用短语注释作为站名
            stationName.textContent = node.phrase || '探索记录';
            
            // 添加序号标签（作为线路编号）- 增大尺寸
            const indexLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            indexLabel.setAttribute('text-anchor', 'middle');
            indexLabel.setAttribute('dominant-baseline', 'central');
            indexLabel.setAttribute('font-size', '12'); // 增大字体
            indexLabel.setAttribute('x', '-24'); // 调整位置
            indexLabel.setAttribute('y', '-24'); // 调整位置
            indexLabel.setAttribute('fill', '#FFFFFF');
            indexLabel.setAttribute('font-weight', 'bold'); // 加粗
            
            // 创建线路编号的背景圆 - 增大尺寸
            const indexBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            indexBg.setAttribute('cx', '-24'); // 调整位置
            indexBg.setAttribute('cy', '-24'); // 调整位置
            indexBg.setAttribute('r', '10'); // 增大半径
            indexBg.setAttribute('fill', '#B7B4AC'); // 使用灰棕色作为线路编号背景
            indexBg.setAttribute('stroke', '#ffffff'); // 添加白色边框
            indexBg.setAttribute('stroke-width', '1'); // 边框宽度
            
            indexLabel.textContent = `${index + 1}`;
            
            // 添加点击事件
            group.style.cursor = 'pointer';
            group.addEventListener('click', () => {
                this.showNodeDetails(node, index);
            });
            
            // 添加移动端轻压预览功能（Peek）
            let touchModal = null;
            group.addEventListener('touchstart', (e) => {
                // 防止触发点击事件
                e.preventDefault();
                
                // 创建临时预览模态框
                touchModal = this.createTouchPreviewModal(node, index);
                document.body.appendChild(touchModal);
            });
            
            group.addEventListener('touchend', () => {
                // 松开手指时移除预览
                if (touchModal) {
                    touchModal.remove();
                    touchModal = null;
                }
            });
            
            group.addEventListener('touchcancel', () => {
                // 触摸取消时也移除预览
                if (touchModal) {
                    touchModal.remove();
                    touchModal = null;
                }
            });
            
            // 添加悬停效果 - 增强效果
            group.addEventListener('mouseenter', () => {
                outerCircle.setAttribute('fill', '#f0f8ff'); // 悬停时改变填充色
                outerCircle.setAttribute('stroke-width', '4.5'); // 增加边框宽度
                // 添加阴影效果
                outerCircle.setAttribute('filter', 'drop-shadow(0px 0px 5px rgba(0,0,0,0.3))');
            });
            
            group.addEventListener('mouseleave', () => {
                outerCircle.setAttribute('fill', '#F5F1E6'); // 恢复原来的填充色
                outerCircle.setAttribute('stroke-width', '3'); // 恢复原来的边框宽度
                // 移除阴影
                outerCircle.removeAttribute('filter');
            });
            
            // 按顺序添加元素
            group.appendChild(indexBg);
            group.appendChild(indexLabel);
            group.appendChild(outerCircle);
            group.appendChild(emojiText);
            
            // 添加文本背景和文本
            if (typeof textBg !== 'undefined') {
                group.appendChild(textBg);
            }
            group.appendChild(stationName);
            
            this.nodeLayer.appendChild(group);
        });
    }
    
    /**
     * 创建触摸预览模态框 - 用于移动端轻压预览
     */
    createTouchPreviewModal(node, index) {
        // 创建轻量级模态框 - 适合移动端轻压预览
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.3);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            touch-action: none;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 12px;
            max-width: 90%;
            max-height: 60%;
            overflow-y: auto;
            border: 2px solid #577A8F;
            box-shadow: 0 6px 16px rgba(0,0,0,0.15);
        `;
        
        // 简化的内容显示 - 适合轻压预览
        const previewContent = `
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <div style="width: 36px; height: 36px; border-radius: 50%; background-color: #B7B4AC; color: white; 
                       display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px;">
                      ${index + 1}
                  </div>
                <h3 style="margin: 0; font-size: 20px; font-weight: bold;">${node.phrase || '探索记录'}</h3>
            </div>
            <div style="height: 2px; background-color: #f0f0f0; margin: 10px 0 15px 0;"></div>
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <span style="font-size: 28px; margin-right: 10px;">${node.emoji}</span>
                <span style="color: #666; font-size: 14px;">${node.content.substring(0, 20)}${node.content.length > 20 ? '...' : ''}</span>
            </div>
            <p style="line-height: 1.6; color: #333; margin: 5px 0 15px 0;">${node.content}</p>
        `;
        
        content.innerHTML = previewContent;
        modal.appendChild(content);
        
        // 阻止模态框上的触摸事件冒泡，以防止滚动和其他交互
        modal.addEventListener('touchmove', (e) => {
            e.preventDefault();
        });
        
        return modal;
    }
    
    /**
     * 显示节点详情 - 地铁站点风格
     */
    showNodeDetails(node, index) {
        // 创建模态框 - 地铁站点信息牌风格
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        // 考虑当前的缩放和平移变换，确保节点详情在缩放和拖拽后仍能正确显示
        const svgRect = this.svg.getBoundingClientRect();
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 25px;
            border-radius: 12px;
            max-width: 450px;
            max-height: 350px;
            overflow-y: auto;
            border: 2px solid #577A8F;
            box-shadow: 0 6px 16px rgba(0,0,0,0.15);
        `;
        
        // 地铁站点风格的内容
        const stationHeader = `
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <div style="width: 36px; height: 36px; border-radius: 50%; background-color: #B7B4AC; color: white; 
                       display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px;">
                      ${index + 1}
                  </div>
                <h3 style="margin: 0; font-size: 20px; font-weight: bold;">${node.phrase || '探索记录'}</h3>
            </div>
            <div style="height: 2px; background-color: #f0f0f0; margin: 10px 0 15px 0;"></div>
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <span style="font-size: 28px; margin-right: 10px;">${node.emoji}</span>
                <span style="color: #666; font-size: 14px;">${node.content.substring(0, 20)}${node.content.length > 20 ? '...' : ''}</span>
            </div>
            <p style="line-height: 1.6; color: #333; margin: 5px 0 15px 0;">${node.content}</p>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="margin-top: 15px; padding: 8px 16px; background: #577A8F; color: white; border: none; 
                           border-radius: 4px; cursor: pointer; font-weight: bold;">
                关闭站点信息
            </button>
        `;
        
        content.innerHTML = stationHeader;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    /**
     * 显示加载状态
     */
    showLoading(text = '正在生成心理地图...') {
        this.container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px; color: #666;">
                <div style="font-size: 24px; margin-bottom: 10px;">🧠</div>
                <div id="mental-map-loading-text">${text}</div>
            </div>
        `;
    }
    
    /**
     * 更新加载文本
     */
    updateLoadingText(text) {
        const loadingText = document.getElementById('mental-map-loading-text');
        if (loadingText) {
            loadingText.textContent = text;
        }
    }
    
    /**
     * 隐藏加载状态
     */
    hideLoading() {
        // 清除加载状态，但保留SVG容器和图层
        this.container.innerHTML = '';
        this.container.appendChild(this.svg);
    }
    
    /**
     * 显示错误信息
     */
    showError(message) {
        this.container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px; color: #dc3545;">
                <div style="font-size: 24px; margin-bottom: 10px;">❌</div>
                <div>${message}</div>
            </div>
        `;
    }
}

// 导出类
window.MentalMap = MentalMap;