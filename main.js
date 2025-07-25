/**
 * Simulador de Circuitos Eléctricos - Aplicación Principal
 * Coordina todos los componentes y maneja la interfaz de usuario
 */
class CircuitSimulatorApp {
    constructor() {
        // Referencias del DOM
        this.canvas = document.getElementById('circuitCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Estado de la aplicación
        this.circuit = new Circuit();
        this.mode = 'select';
        this.isDrawing = false;
        this.startPoint = null;
        this.mousePos = { x: 0, y: 0 };
        this.selectedComponent = null;
        this.clipboardComponent = null;
        
        // Configuración
        this.config = {
            snapDistance: 20,
            gridSize: 20,
            connectionRadius: 8,
            animationSpeed: 16,
            showGrid: true,
            showConnectionPoints: true,
            showCurrentFlow: false,
            showVoltageNodes: false,
            animateCurrentFlow: false,
            highQualityRendering: true
        };
        
        // Simulación
        this.simulation = {
            isRunning: false,
            interval: null,
            speed: 500,
            step: 0,
            data: [],
            analysisType: 'dc'
        };
        
        // Historial para deshacer/rehacer
        this.history = {
            states: [],
            currentIndex: -1,
            maxStates: 50
        };
        
        // Sistema de eventos
        this.eventListeners = new Map();
        
        // Herramientas de análisis
        this.analyzer = new CircuitAnalyzer();
        this.visualizer = new CircuitVisualizer(this.canvas, this.ctx);
        
        // Inicializar
        this.init();
    }

    /**
     * Inicializa la aplicación
     */
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupUI();
        this.loadSettings();
        this.saveState(); // Estado inicial
        this.startRenderLoop();
        
        console.log('Circuit Simulator App initialized');
    }

    /**
     * Configura el canvas
     */
    setupCanvas() {
        this.resizeCanvas();
        
        // Configurar renderizado de alta calidad
        if (this.config.highQualityRendering) {
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
        }
        
        // Configurar contexto 2D
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.textBaseline = 'middle';
    }

    /**
     * Redimensiona el canvas
     */
    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Configurar tamaño del canvas para alta resolución
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        // Escalar contexto para alta resolución
        this.ctx.scale(dpr, dpr);
        
        // Actualizar visualizador
        if (this.visualizer) {
            this.visualizer.updateCanvasSize(rect.width, rect.height);
        }
    }

    /**
     * Configura eventos del DOM
     */
    setupEventListeners() {
        // Eventos del canvas
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        
        // Eventos de ventana
        window.addEventListener('resize', () => this.resizeCanvas());
        window.addEventListener('beforeunload', (e) => this.handleBeforeUnload(e));
        
        // Eventos de teclado
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Eventos de la interfaz
        this.setupUIEventListeners();
    }

    /**
     * Configura eventos de la interfaz de usuario
     */
    setupUIEventListeners() {
        // Botones de componentes
        document.querySelectorAll('.component-btn[data-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setMode(e.target.dataset.mode);
                this.updateActiveButton(e.target);
            });
        });
        
        // Controles de simulación
        this.setupElement('playSimulation', 'click', () => this.startSimulation());
        this.setupElement('pauseSimulation', 'click', () => this.pauseSimulation());
        this.setupElement('resetSimulation', 'click', () => this.resetSimulation());
        this.setupElement('simulateOnce', 'click', () => this.simulateOnce());
        
        // Controles de análisis
        this.setupElement('analyzeCircuit', 'click', () => this.analyzeCircuit());
        this.setupElement('jouleLawBtn', 'click', () => this.calculateJouleLaw());
        this.setupElement('voltageDropsBtn', 'click', () => this.analyzeVoltageDrops());
        this.setupElement('powerAnalysisBtn', 'click', () => this.analyzePower());
        this.setupElement('frequencyResponseBtn', 'click', () => this.analyzeFrequencyResponse());
        
        // Controles de archivo
        this.setupElement('exportData', 'click', () => this.exportCircuit());
        this.setupElement('importData', 'click', () => this.importCircuit());
        this.setupElement('generateReport', 'click', () => this.generateReport());
        
        // Controles de edición
        this.setupElement('clearBtn', 'click', () => this.clearCircuit());
        this.setupElement('undoBtn', 'click', () => this.undo());
        this.setupElement('redoBtn', 'click', () => this.redo());
        this.setupElement('updateComponentBtn', 'click', () => this.updateSelectedComponent());
        
        // Controles de configuración
        this.setupElement('simulationSpeed', 'input', (e) => this.updateSimulationSpeed(e.target.value));
        this.setupElement('gridSize', 'input', (e) => this.updateGridSize(e.target.value));
        
        // Checkboxes de visualización
        this.setupElement('showCurrentFlow', 'change', (e) => {
            this.config.showCurrentFlow = e.target.checked;
            this.updateVisualization();
        });
        this.setupElement('showVoltageNodes', 'change', (e) => {
            this.config.showVoltageNodes = e.target.checked;
            this.updateVisualization();
        });
        this.setupElement('animateCurrentFlow', 'change', (e) => {
            this.config.animateCurrentFlow = e.target.checked;
            this.updateVisualization();
        });
        
        // Análisis avanzado
        this.setupElement('advancedAnalysisBtn', 'click', () => this.performAdvancedAnalysis());
        this.setupElement('analysisType', 'change', (e) => {
            this.simulation.analysisType = e.target.value;
        });
        
        // Gráficos
        this.setupElement('showVIChart', 'click', () => this.showVIChart());
        this.setupElement('showPowerChart', 'click', () => this.showPowerChart());
        this.setupElement('showFreqResponse', 'click', () => this.showFrequencyResponse());
    }

    /**
     * Configura un elemento del DOM de forma segura
     */
    setupElement(id, event, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        }
    }

    /**
     * Configura la interfaz de usuario
     */
    setupUI() {
        this.updateModeIndicator();
        this.updateComponentSelector();
        this.updateSpeedDisplay();
        this.updateGridDisplay();
        this.updateCoordinatesDisplay();
    }

    /**
     * Maneja eventos del mouse
     */
    handleMouseDown(e) {
        this.mousePos = this.getMousePos(e);
        
        switch (this.mode) {
            case 'wire':
                this.startWireDrawing();
                break;
            case 'move':
            case 'select':
                this.startSelection();
                break;
            case 'delete':
                this.deleteAtPosition();
                break;
        }
        
        this.updateCoordinatesDisplay();
    }

    handleMouseMove(e) {
        this.mousePos = this.getMousePos(e);
        
        if (this.isDrawing) {
            switch (this.mode) {
                case 'wire':
                    this.updateWirePreview();
                    break;
                case 'move':
                    this.updateComponentPosition();
                    break;
            }
        }
        
        this.updateHoverEffects();
        this.updateCoordinatesDisplay();
        this.render();
    }

    handleMouseUp(e) {
        if (this.isDrawing) {
            switch (this.mode) {
                case 'wire':
                    this.finishWireDrawing();
                    break;
                case 'move':
                    this.finishComponentMove();
                    break;
            }
        }
        
        this.isDrawing = false;
        this.render();
    }

    handleClick(e) {
        this.mousePos = this.getMousePos(e);
        
        switch (this.mode) {
            case 'select':
                this.selectComponent();
                break;
            case 'rotate':
                this.rotateComponent();
                break;
            case 'resistor':
            case 'voltage':
            case 'current':
            case 'capacitor':
            case 'inductor':
            case 'diode':
            case 'ground':
                this.addComponent();
                break;
        }
        
        this.render();
    }

    handleDoubleClick(e) {
        const component = this.getComponentAtPosition(this.mousePos);
        if (component) {
            this.editComponent(component);
        }
    }

    handleWheel(e) {
        e.preventDefault();
        // Implementar zoom en versiones futuras
    }

    handleContextMenu(e) {
        e.preventDefault();
        this.showContextMenu(e);
    }

    /**
     * Maneja eventos del teclado
     */
    handleKeyDown(e) {
        // Atajos de teclado
        const shortcuts = {
            'KeyR': () => this.setMode('resistor'),
            'KeyV': () => this.setMode('voltage'),
            'KeyC': () => this.setMode('current'),
            'KeyW': () => this.setMode('wire'),
            'KeyG': () => this.setMode('ground'),
            'KeyS': () => this.setMode('select'),
            'KeyM': () => this.setMode('move'),
            'KeyT': () => this.setMode('rotate'),
            'Delete': () => this.setMode('delete'),
            'Escape': () => this.setMode('select'),
            'Space': () => this.simulateOnce(),
            'Enter': () => this.startSimulation()
        };
        
        // Combinaciones con Ctrl
        if (e.ctrlKey) {
            const ctrlShortcuts = {
                'KeyZ': () => this.undo(),
                'KeyY': () => this.redo(),
                'KeyS': () => this.saveCircuit(),
                'KeyO': () => this.loadCircuit(),
                'KeyN': () => this.newCircuit(),
                'KeyC': () => this.copyComponent(),
                'KeyV': () => this.pasteComponent(),
                'KeyA': () => this.selectAll()
            };
            
            if (ctrlShortcuts[e.code]) {
                e.preventDefault();
                ctrlShortcuts[e.code]();
            }
        } else if (shortcuts[e.code]) {
            e.preventDefault();
            shortcuts[e.code]();
        }
        
        // Teclas de flecha para mover componentes
        if (this.selectedComponent && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
            e.preventDefault();
            this.moveSelectedComponent(e.code);
        }
    }

    handleKeyUp(e) {
        // Manejar liberación de teclas si es necesario
    }

    /**
     * Obtiene la posición del mouse relativa al canvas
     */
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    /**
     * Inicia el dibujo de un cable
     */
    startWireDrawing() {
        const snapPoint = this.findNearestConnectionPoint(this.mousePos);
        this.startPoint = snapPoint || { ...this.mousePos };
        this.isDrawing = true;
    }

    /**
     * Finaliza el dibujo de un cable
     */
    finishWireDrawing() {
        const snapPoint = this.findNearestConnectionPoint(this.mousePos);
        const endPoint = snapPoint || { ...this.mousePos };
        
        const wire = new Wire(this.startPoint, endPoint, {
            orthogonal: document.getElementById('orthogonalWires')?.checked || false,
            freeDrawing: document.getElementById('freeDrawing')?.checked || false,
            snapToGrid: document.getElementById('snapToGrid')?.checked || false
        });
        
        if (this.circuit.addWire(wire)) {
            this.saveState();
            this.emit('wireAdded', { wire });
        }
    }

    /**
     * Inicia la selección de componente
     */
    startSelection() {
        const component = this.getComponentAtPosition(this.mousePos);
        
        if (component) {
            this.selectComponent(component);
            if (this.mode === 'move') {
                this.isDrawing = true;
            }
        } else {
            this.selectComponent(null);
        }
    }

    /**
     * Selecciona un componente
     */
    selectComponent(component = null) {
        // Deseleccionar componente anterior
        if (this.selectedComponent) {
            this.selectedComponent.isSelected = false;
        }
        
        // Seleccionar nuevo componente
        this.selectedComponent = component;
        if (component) {
            component.isSelected = true;
            this.populateComponentEditor(component);
        }
        
        this.updateComponentSelector();
        this.emit('componentSelected', { component });
    }

    /**
     * Añade un componente al circuito
     */
    addComponent() {
        const ComponentClass = this.getComponentClass(this.mode);
        if (!ComponentClass) return;
        
        const component = new ComponentClass(this.mousePos.x, this.mousePos.y);
        
        if (this.circuit.addComponent(component)) {
            this.selectComponent(component);
            this.saveState();
            this.emit('componentAdded', { component });
        }
    }

    /**
     * Obtiene la clase del componente según el tipo
     */
    getComponentClass(type) {
        const classes = {
            'resistor': Resistor,
            'voltage': VoltageSource,
            'current': CurrentSource,
            'capacitor': Capacitor,
            'inductor': Inductor,
            'diode': Diode,
            'ground': Ground
        };
        return classes[type];
    }

    /**
     * Busca el punto de conexión más cercano
     */
    findNearestConnectionPoint(pos) {
        let nearest = null;
        let minDistance = this.config.snapDistance;
        
        // Buscar en componentes
        this.circuit.components.forEach(component => {
            const points = component.getConnectionPoints();
            points.forEach(point => {
                const distance = this.calculateDistance(pos, point);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = { ...point, componentId: component.id };
                }
            });
        });
        
        // Buscar en cables (si está habilitado el dibujo libre)
        if (document.getElementById('freeDrawing')?.checked) {
            this.circuit.wires.forEach(wire => {
                wire.path.forEach(point => {
                    const distance = this.calculateDistance(pos, point);
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearest = { ...point, wireId: wire.id };
                    }
                });
            });
        }
        
        return nearest;
    }

    /**
     * Calcula distancia entre dos puntos
     */
    calculateDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Obtiene el componente en una posición
     */
    getComponentAtPosition(pos) {
        return this.circuit.components.find(component => 
            component.containsPoint(pos.x, pos.y)
        );
    }

    /**
     * Establece el modo de operación
     */
    setMode(mode) {
        this.mode = mode;
        this.updateModeIndicator();
        this.updateCanvasCursor();
        
        // Cancelar operaciones en curso
        this.isDrawing = false;
        this.startPoint = null;
        
        this.emit('modeChanged', { mode });
    }

    /**
     * Actualiza el cursor del canvas según el modo
     */
    updateCanvasCursor() {
        const cursors = {
            'select': 'default',
            'move': 'grab',
            'delete': 'crosshair',
            'rotate': 'grab',
            'wire': 'crosshair',
            'resistor': 'copy',
            'voltage': 'copy',
            'current': 'copy',
            'capacitor': 'copy',
            'inductor': 'copy',
            'diode': 'copy',
            'ground': 'copy'
        };
        
        this.canvas.style.cursor = cursors[this.mode] || 'default';
    }

    /**
     * Inicia la simulación continua
     */
    startSimulation() {
        if (this.simulation.isRunning) return;
        
        this.simulation.isRunning = true;
        this.simulation.step = 0;
        
        this.simulation.interval = setInterval(() => {
            this.runSimulationStep();
        }, this.simulation.speed);
        
        this.updateSimulationButtons();
        this.emit('simulationStarted');
    }

    /**
     * Pausa la simulación
     */
    pauseSimulation() {
        if (!this.simulation.isRunning) return;
        
        this.simulation.isRunning = false;
        clearInterval(this.simulation.interval);
        this.simulation.interval = null;
        
        this.updateSimulationButtons();
        this.emit('simulationPaused');
    }

    /**
     * Reinicia la simulación
     */
    resetSimulation() {
        this.pauseSimulation();
        this.simulation.step = 0;
        this.simulation.data = [];
        
        // Limpiar datos de simulación
        this.circuit.components.forEach(comp => {
            comp.current = 0;
            comp.voltage = 0;
            comp.power = 0;
        });
        
        this.circuit.wires.forEach(wire => {
            wire.current = 0;
            wire.voltage = 0;
            wire.power = 0;
        });
        
        this.updateResults('Simulación reiniciada');
        this.render();
        this.emit('simulationReset');
    }

    /**
     * Ejecuta una simulación única
     */
    simulateOnce() {
        try {
            const analysis = this.analyzer.analyzeCircuit(this.circuit);
            
            if (analysis.isValid) {
                this.applySimulationResults(analysis);
                this.updateResults(this.formatSimulationResults(analysis));
                this.render();
                this.emit('simulationCompleted', { analysis });
            } else {
                this.updateResults(`Error: ${analysis.error}`);
                this.emit('simulationError', { error: analysis.error });
            }
        } catch (error) {
            console.error('Simulation error:', error);
            this.updateResults(`Error de simulación: ${error.message}`);
        }
    }

    /**
     * Ejecuta un paso de simulación
     */
    runSimulationStep() {
        this.simulateOnce();
        this.simulation.step++;
        
        // Actualizar display en tiempo real
        if (this.simulation.step % 5 === 0) {
            this.updateRealTimeDisplay();
        }
    }

    /**
     * Aplica los resultados de simulación a los componentes
     */
    applySimulationResults(analysis) {
        // Aplicar corrientes y voltajes a componentes
        Object.entries(analysis.componentValues).forEach(([id, values]) => {
            const component = this.circuit.components.find(c => c.id === id);
            if (component) {
                component.current = values.current || 0;
                component.voltage = values.voltage || 0;
                component.power = values.power || 0;
            }
        });
        
        // Aplicar corrientes a cables
        Object.entries(analysis.currentFlow).forEach(([id, current]) => {
            const wire = this.circuit.wires.find(w => w.id === id);
            if (wire) {
                wire.current = current;
                wire.power = Math.abs(current * current * wire.resistance);
            }
        });
    }

    /**
     * Formatea los resultados de simulación
     */
    formatSimulationResults(analysis) {
        return `
            <h5>✅ Simulación Exitosa</h5>
            <div class="result-item">
                <span>Tipo de Circuito:</span>
                <span>${analysis.circuitType || 'Desconocido'}</span>
            </div>
            <div class="result-item">
                <span>Resistencia Total:</span>
                <span>${analysis.totalResistance?.toFixed(2) || 'N/A'} Ω</span>
            </div>
            <div class="result-item">
                <span>Corriente Total:</span>
                <span>${analysis.totalCurrent?.toFixed(4) || 'N/A'} A</span>
            </div>
            <div class="result-item">
                <span>Potencia Total:</span>
                <span>${analysis.totalPower?.toFixed(2) || 'N/A'} W</span>
            </div>
            <div class="result-item">
                <span>Componentes:</span>
                <span>${this.circuit.components.length}</span>
            </div>
            <div class="result-item">
                <span>Conexiones:</span>
                <span>${this.circuit.wires.length}</span>
            </div>
        `;
    }

    /**
     * Loop principal de renderizado
     */
    startRenderLoop() {
        const renderFrame = () => {
            this.render();
            requestAnimationFrame(renderFrame);
        };
        requestAnimationFrame(renderFrame);
    }

    /**
     * Renderiza el circuito
     */
    render() {
        // Limpiar canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Dibujar cuadrícula
        if (this.config.showGrid) {
            this.visualizer.drawGrid(this.config.gridSize);
        }
        
        // Dibujar componentes y cables
        this.visualizer.drawCircuit(this.circuit, {
            showConnectionPoints: this.config.showConnectionPoints,
            showCurrentFlow: this.config.showCurrentFlow,
            showVoltageNodes: this.config.showVoltageNodes,
            animateCurrentFlow: this.config.animateCurrentFlow,
            selectedComponent: this.selectedComponent
        });
        
        // Dibujar preview si está dibujando
        if (this.isDrawing && this.mode === 'wire') {
            this.visualizer.drawWirePreview(this.startPoint, this.mousePos, {
                orthogonal: document.getElementById('orthogonalWires')?.checked || false
            });
        }
    }

    /**
     * Actualiza elementos de la interfaz
     */
    updateModeIndicator() {
        const indicator = document.getElementById('modeIndicator');
        if (indicator) {
            const modeNames = {
                'select': 'Seleccionar',
                'move': 'Mover',
                'delete': 'Eliminar',
                'rotate': 'Rotar',
                'wire': 'Dibujar Cable',
                'resistor': 'Agregar Resistencia',
                'voltage': 'Agregar Fuente de Voltaje',
                'current': 'Agregar Fuente de Corriente',
                'capacitor': 'Agregar Capacitor',
                'inductor': 'Agregar Inductor',
                'diode': 'Agregar Diodo',
                'ground': 'Agregar Tierra'
            };
            indicator.textContent = `Modo: ${modeNames[this.mode] || this.mode}`;
        }
    }

    updateSimulationButtons() {
        const playBtn = document.getElementById('playSimulation');
        const pauseBtn = document.getElementById('pauseSimulation');
        
        if (playBtn) playBtn.disabled = this.simulation.isRunning;
        if (pauseBtn) pauseBtn.disabled = !this.simulation.isRunning;
    }

    updateResults(content) {
        const resultsContent = document.getElementById('resultsContent');
        if (resultsContent) {
            resultsContent.innerHTML = content;
        }
    }

    updateCoordinatesDisplay() {
        const coords = document.getElementById('coordinates');
        if (coords) {
            coords.textContent = `X: ${Math.round(this.mousePos.x)}, Y: ${Math.round(this.mousePos.y)}`;
        }
    }

    /**
     * Sistema de eventos
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Gestión del historial (deshacer/rehacer)
     */
    saveState() {
        const state = this.circuit.toJSON();
        
        // Eliminar estados futuros si estamos en el medio del historial
        if (this.history.currentIndex < this.history.states.length - 1) {
            this.history.states = this.history.states.slice(0, this.history.currentIndex + 1);
        }
        
        // Añadir nuevo estado
        this.history.states.push(JSON.stringify(state));
        this.history.currentIndex++;
        
        // Limitar el número de estados
        if (this.history.states.length > this.history.maxStates) {
            this.history.states.shift();
            this.history.currentIndex--;
        }
        
        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.history.currentIndex > 0) {
            this.history.currentIndex--;
            const state = JSON.parse(this.history.states[this.history.currentIndex]);
            this.circuit.fromJSON(state);
            this.selectedComponent = null;
            this.render();
            this.updateUndoRedoButtons();
        }
    }

    redo() {
        if (this.history.currentIndex < this.history.states.length - 1) {
            this.history.currentIndex++;
            const state = JSON.parse(this.history.states[this.history.currentIndex]);
            this.circuit.fromJSON(state);
            this.selectedComponent = null;
            this.render();
            this.updateUndoRedoButtons();
        }
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        
        if (undoBtn) undoBtn.disabled = this.history.currentIndex <= 0;
        if (redoBtn) redoBtn.disabled = this.history.currentIndex >= this.history.states.length - 1;
    }

    /**
     * Limpia recursos al cerrar
     */
    dispose() {
        this.pauseSimulation();
        this.eventListeners.clear();
        this.circuit.dispose();
        this.analyzer.dispose();
        this.visualizer.dispose();
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.circuitApp = new CircuitSimulatorApp();
    
    // Exponer funciones globales para compatibilidad
    window.setMode = (mode) => window.circuitApp.setMode(mode);
    window.simulateCircuit = () => window.circuitApp.simulateOnce();
    window.startSimulation = () => window.circuitApp.startSimulation();
    window.pauseSimulation = () => window.circuitApp.pauseSimulation();
    window.resetSimulation = () => window.circuitApp.resetSimulation();
    window.clearCanvas = () => window.circuitApp.clearCircuit();
});