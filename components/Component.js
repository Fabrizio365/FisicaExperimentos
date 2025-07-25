/**
 * Clase base para todos los componentes del circuito
 * Proporciona funcionalidad común y define la interfaz estándar
 */
class Component {
    constructor(type, x, y, options = {}) {
        this.id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = options.width || 40;
        this.height = options.height || 20;
        this.rotation = options.rotation || 0;
        this.value = options.value || this.getDefaultValue();
        this.unit = options.unit || this.getDefaultUnit();
        this.label = options.label || `${type}_${this.getNextIndex()}`;
        this.color = options.color || this.getDefaultColor();
        this.isSelected = false;
        this.isHighlighted = false;
        
        // Propiedades eléctricas calculadas
        this.voltage = 0;
        this.current = 0;
        this.power = 0;
        this.impedance = this.calculateImpedance();
        
        // Propiedades de análisis
        this.nodeConnections = [];
        this.terminalVoltages = [];
        this.branchCurrents = [];
        
        // Metadatos
        this.createdAt = new Date();
        this.lastModified = new Date();
        this.properties = new Map();
        
        // Eventos
        this.eventListeners = new Map();
        
        // Validación inicial
        this.validate();
    }

    /**
     * Obtiene el valor por defecto según el tipo de componente
     */
    getDefaultValue() {
        const defaults = {
            'resistor': 1000,
            'voltage': 12,
            'current': 0.001,
            'capacitor': 0.000001,
            'inductor': 0.001,
            'diode': 0.7
        };
        return defaults[this.type] || 0;
    }

    /**
     * Obtiene la unidad por defecto según el tipo de componente
     */
    getDefaultUnit() {
        const units = {
            'resistor': 'Ω',
            'voltage': 'V',
            'current': 'A',
            'capacitor': 'F',
            'inductor': 'H',
            'diode': 'V'
        };
        return units[this.type] || '';
    }

    /**
     * Obtiene el color por defecto según el tipo de componente
     */
    getDefaultColor() {
        const colors = {
            'resistor': '#f39c12',
            'voltage': '#e74c3c',
            'current': '#3498db',
            'capacitor': '#9b59b6',
            'inductor': '#2ecc71',
            'diode': '#e67e22',
            'ground': '#34495e'
        };
        return colors[this.type] || '#3498db';
    }

    /**
     * Obtiene el siguiente índice para la etiqueta
     */
    getNextIndex() {
        if (!Component.counters) {
            Component.counters = {};
        }
        if (!Component.counters[this.type]) {
            Component.counters[this.type] = 0;
        }
        return ++Component.counters[this.type];
    }

    /**
     * Calcula la impedancia del componente
     */
    calculateImpedance(frequency = 0) {
        switch (this.type) {
            case 'resistor':
                return { real: this.value, imaginary: 0 };
            case 'capacitor':
                if (frequency === 0) return { real: Infinity, imaginary: 0 };
                const Xc = -1 / (2 * Math.PI * frequency * this.value);
                return { real: 0, imaginary: Xc };
            case 'inductor':
                const XL = 2 * Math.PI * frequency * this.value;
                return { real: 0, imaginary: XL };
            default:
                return { real: this.value, imaginary: 0 };
        }
    }

    /**
     * Obtiene los puntos de conexión del componente
     */
    getConnectionPoints() {
        const points = [];
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);
        
        // Puntos base según el tipo de componente
        const basePoints = this.getBaseConnectionPoints();
        
        // Aplicar rotación
        basePoints.forEach(point => {
            const rotatedX = point.x * cos - point.y * sin;
            const rotatedY = point.x * sin + point.y * cos;
            
            points.push({
                x: this.x + rotatedX,
                y: this.y + rotatedY,
                componentId: this.id,
                terminal: point.terminal || 'default'
            });
        });
        
        return points;
    }

    /**
     * Obtiene los puntos de conexión base (sin rotación)
     * Debe ser implementado por cada subclase
     */
    getBaseConnectionPoints() {
        // Implementación por defecto para componentes de 2 terminales
        return [
            { x: -this.width/2 - 10, y: 0, terminal: 'left' },
            { x: this.width/2 + 10, y: 0, terminal: 'right' }
        ];
    }

    /**
     * Verifica si un punto está dentro del componente
     */
    containsPoint(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        
        // Aplicar rotación inversa
        const cos = Math.cos(-this.rotation);
        const sin = Math.sin(-this.rotation);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;
        
        return Math.abs(localX) <= this.width/2 && Math.abs(localY) <= this.height/2;
    }

    /**
     * Dibuja el componente en el canvas
     */
    draw(ctx, options = {}) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Efectos visuales según el estado
        if (this.isSelected) {
            this.drawSelectionHighlight(ctx);
        }
        
        if (this.isHighlighted) {
            this.drawHoverEffect(ctx);
        }
        
        // Dibujar el componente específico
        this.drawComponent(ctx, options);
        
        // Dibujar etiquetas y valores
        if (options.showLabels !== false) {
            this.drawLabels(ctx, options);
        }
        
        // Dibujar información de análisis si está disponible
        if (options.showAnalysis && (this.current !== 0 || this.voltage !== 0)) {
            this.drawAnalysisInfo(ctx, options);
        }
        
        ctx.restore();
        
        // Dibujar puntos de conexión
        if (options.showConnectionPoints) {
            this.drawConnectionPoints(ctx);
        }
    }

    /**
     * Dibuja el componente específico - debe ser implementado por subclases
     */
    drawComponent(ctx, options) {
        // Implementación por defecto - rectángulo simple
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.width/2, -this.height/2, this.width, this.height);
    }

    /**
     * Dibuja el efecto de selección
     */
    drawSelectionHighlight(ctx) {
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(-this.width/2 - 5, -this.height/2 - 5, 
                      this.width + 10, this.height + 10);
        ctx.setLineDash([]);
    }

    /**
     * Dibuja el efecto de hover
     */
    drawHoverEffect(ctx) {
        ctx.fillStyle = 'rgba(52, 152, 219, 0.2)';
        ctx.fillRect(-this.width/2 - 3, -this.height/2 - 3, 
                     this.width + 6, this.height + 6);
    }

    /**
     * Dibuja las etiquetas del componente
     */
    drawLabels(ctx, options) {
        ctx.fillStyle = '#2c3e50';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        
        // Valor y unidad
        const valueText = `${this.formatValue(this.value)}${this.unit}`;
        ctx.fillText(valueText, 0, -this.height/2 - 10);
        
        // Etiqueta
        ctx.fillText(this.label, 0, this.height/2 + 20);
    }

    /**
     * Dibuja información de análisis
     */
    drawAnalysisInfo(ctx, options) {
        ctx.fillStyle = '#e74c3c';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        
        let offset = this.height/2 + 35;
        
        if (Math.abs(this.current) > 0.001) {
            ctx.fillText(`I: ${this.formatValue(this.current)}A`, 0, offset);
            offset += 12;
        }
        
        if (Math.abs(this.voltage) > 0.001) {
            ctx.fillText(`V: ${this.formatValue(this.voltage)}V`, 0, offset);
            offset += 12;
        }
        
        if (Math.abs(this.power) > 0.001) {
            ctx.fillText(`P: ${this.formatValue(this.power)}W`, 0, offset);
        }
    }

    /**
     * Dibuja los puntos de conexión
     */
    drawConnectionPoints(ctx) {
        const points = this.getConnectionPoints();
        points.forEach(point => {
            ctx.fillStyle = '#27ae60';
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    }

    /**
     * Formatea un valor numérico para mostrar
     */
    formatValue(value) {
        if (Math.abs(value) >= 1e6) {
            return (value / 1e6).toFixed(2) + 'M';
        } else if (Math.abs(value) >= 1e3) {
            return (value / 1e3).toFixed(2) + 'k';
        } else if (Math.abs(value) >= 1) {
            return value.toFixed(3);
        } else if (Math.abs(value) >= 1e-3) {
            return (value * 1e3).toFixed(2) + 'm';
        } else if (Math.abs(value) >= 1e-6) {
            return (value * 1e6).toFixed(2) + 'μ';
        } else if (Math.abs(value) >= 1e-9) {
            return (value * 1e9).toFixed(2) + 'n';
        } else {
            return value.toExponential(2);
        }
    }

    /**
     * Actualiza las propiedades del componente
     */
    updateProperties(properties) {
        Object.keys(properties).forEach(key => {
            if (this.hasOwnProperty(key)) {
                this[key] = properties[key];
                this.lastModified = new Date();
            }
        });
        
        // Recalcular impedancia si cambia el valor
        if (properties.value !== undefined || properties.unit !== undefined) {
            this.impedance = this.calculateImpedance();
        }
        
        this.validate();
        this.emit('propertyChanged', { component: this, properties });
    }

    /**
     * Rota el componente
     */
    rotate(angle = Math.PI / 2) {
        this.rotation += angle;
        this.rotation = this.rotation % (2 * Math.PI);
        this.lastModified = new Date();
        this.emit('rotated', { component: this, rotation: this.rotation });
    }

    /**
     * Mueve el componente
     */
    moveTo(x, y) {
        this.x = x;
        this.y = y;
        this.lastModified = new Date();
        this.emit('moved', { component: this, x, y });
    }

    /**
     * Clona el componente
     */
    clone() {
        const cloned = new this.constructor(this.x + 20, this.y + 20, {
            width: this.width,
            height: this.height,
            rotation: this.rotation,
            value: this.value,
            unit: this.unit,
            color: this.color
        });
        
        // Copiar propiedades personalizadas
        this.properties.forEach((value, key) => {
            cloned.properties.set(key, value);
        });
        
        return cloned;
    }

    /**
     * Valida el componente
     */
    validate() {
        const errors = [];
        
        if (typeof this.value !== 'number' || isNaN(this.value)) {
            errors.push('El valor debe ser un número válido');
        }
        
        if (this.value < 0 && !this.allowsNegativeValues()) {
            errors.push('Este componente no permite valores negativos');
        }
        
        if (this.value === 0 && !this.allowsZeroValue()) {
            errors.push('Este componente no puede tener valor cero');
        }
        
        this.validationErrors = errors;
        this.isValid = errors.length === 0;
        
        return this.isValid;
    }

    /**
     * Indica si el componente permite valores negativos
     */
    allowsNegativeValues() {
        return ['voltage', 'current'].includes(this.type);
    }

    /**
     * Indica si el componente permite valor cero
     */
    allowsZeroValue() {
        return ['voltage', 'current', 'ground'].includes(this.type);
    }

    /**
     * Convierte el componente a objeto serializable
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            rotation: this.rotation,
            value: this.value,
            unit: this.unit,
            label: this.label,
            color: this.color,
            properties: Object.fromEntries(this.properties),
            createdAt: this.createdAt.toISOString(),
            lastModified: this.lastModified.toISOString()
        };
    }

    /**
     * Crea un componente desde un objeto JSON
     */
    static fromJSON(data) {
        const component = new Component(data.type, data.x, data.y, {
            width: data.width,
            height: data.height,
            rotation: data.rotation,
            value: data.value,
            unit: data.unit,
            label: data.label,
            color: data.color
        });
        
        component.id = data.id;
        component.createdAt = new Date(data.createdAt);
        component.lastModified = new Date(data.lastModified);
        
        if (data.properties) {
            Object.entries(data.properties).forEach(([key, value]) => {
                component.properties.set(key, value);
            });
        }
        
        return component;
    }

    /**
     * Sistema de eventos simple
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
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
     * Limpia recursos del componente
     */
    dispose() {
        this.eventListeners.clear();
        this.nodeConnections = [];
        this.terminalVoltages = [];
        this.branchCurrents = [];
        this.properties.clear();
    }
}

// Registrar tipos de componentes disponibles
Component.types = [
    'resistor', 'voltage', 'current', 'capacitor', 
    'inductor', 'diode', 'ground', 'wire'
];

Component.counters = {};