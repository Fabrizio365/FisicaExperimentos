/**
 * Clase para cables/conexiones del circuito
 * Maneja conexiones ortogonales, libres y con uniones
 */
class Wire {
    constructor(startPoint, endPoint, options = {}) {
        this.id = `wire_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.start = { ...startPoint };
        this.end = { ...endPoint };
        this.type = 'wire';
        
        // Propiedades del cable
        this.resistance = options.resistance || 0; // Resistencia del cable (Ohms)
        this.inductance = options.inductance || 0; // Inductancia parásita (H)
        this.capacitance = options.capacitance || 0; // Capacitancia parásita (F)
        this.maxCurrent = options.maxCurrent || Infinity; // Corriente máxima (A)
        this.color = options.color || '#2c3e50';
        this.width = options.width || 2;
        
        // Configuración de dibujo
        this.orthogonal = options.orthogonal || false;
        this.freeDrawing = options.freeDrawing || false;
        this.snapToGrid = options.snapToGrid || false;
        
        // Conexiones
        this.startComponent = startPoint.componentId || null;
        this.endComponent = endPoint.componentId || null;
        this.startWire = startPoint.wireId || null;
        this.endWire = endPoint.wireId || null;
        this.startTerminal = startPoint.terminal || 'default';
        this.endTerminal = endPoint.terminal || 'default';
        
        // Ruta del cable
        this.path = [];
        this.calculatePath();
        
        // Estado eléctrico
        this.current = 0;
        this.voltage = 0;
        this.power = 0;
        this.temperature = 25;
        
        // Propiedades físicas
        this.length = this.calculateLength();
        this.crossSection = options.crossSection || 1e-6; // m²
        this.material = options.material || 'copper';
        this.resistivity = this.getMaterialResistivity();
        
        // Estado visual
        this.isSelected = false;
        this.isHighlighted = false;
        this.showCurrentDirection = false;
        this.animateCurrentFlow = false;
        
        // Metadatos
        this.createdAt = new Date();
        this.lastModified = new Date();
        this.junctions = []; // Uniones con otros cables
        
        // Eventos
        this.eventListeners = new Map();
        
        // Calcular resistencia real basada en propiedades físicas
        this.updatePhysicalProperties();
    }

    /**
     * Calcula la ruta del cable según configuración
     */
    calculatePath() {
        this.path = [this.start];
        
        if (this.orthogonal && !this.freeDrawing) {
            // Cable ortogonal (ángulos de 90°)
            const midPoints = this.calculateOrthogonalPath();
            this.path.push(...midPoints);
        }
        
        this.path.push(this.end);
        
        // Aplicar snap to grid si está habilitado
        if (this.snapToGrid) {
            this.path = this.path.map(point => this.snapPointToGrid(point));
        }
        
        this.length = this.calculateLength();
    }

    /**
     * Calcula ruta ortogonal entre dos puntos
     */
    calculateOrthogonalPath() {
        const dx = this.end.x - this.start.x;
        const dy = this.end.y - this.start.y;
        
        // Determinar el mejor punto intermedio
        if (Math.abs(dx) > Math.abs(dy)) {
            // Movimiento horizontal primero
            return [{ x: this.end.x, y: this.start.y }];
        } else {
            // Movimiento vertical primero
            return [{ x: this.start.x, y: this.end.y }];
        }
    }

    /**
     * Alinea un punto a la cuadrícula
     */
    snapPointToGrid(point, gridSize = 20) {
        return {
            x: Math.round(point.x / gridSize) * gridSize,
            y: Math.round(point.y / gridSize) * gridSize
        };
    }

    /**
     * Calcula la longitud total del cable
     */
    calculateLength() {
        let totalLength = 0;
        
        for (let i = 0; i < this.path.length - 1; i++) {
            const dx = this.path[i + 1].x - this.path[i].x;
            const dy = this.path[i + 1].y - this.path[i].y;
            totalLength += Math.sqrt(dx * dx + dy * dy);
        }
        
        // Convertir de píxeles a metros (escala aproximada)
        return totalLength * 0.001; // 1 píxel = 1 mm
    }

    /**
     * Obtiene la resistividad del material
     */
    getMaterialResistivity() {
        const resistivities = {
            'copper': 1.68e-8,     // Ω·m
            'aluminum': 2.65e-8,   // Ω·m
            'silver': 1.59e-8,     // Ω·m
            'gold': 2.24e-8,       // Ω·m
            'iron': 9.71e-8        // Ω·m
        };
        return resistivities[this.material] || resistivities['copper'];
    }

    /**
     * Actualiza propiedades físicas del cable
     */
    updatePhysicalProperties() {
        // Calcular resistencia basada en geometría y material
        if (this.length > 0 && this.crossSection > 0) {
            this.resistance = (this.resistivity * this.length) / this.crossSection;
        }
        
        // Inductancia parásita aproximada para un cable recto
        if (this.length > 0) {
            this.inductance = 2e-7 * this.length * (Math.log(this.length / Math.sqrt(this.crossSection)) - 0.75);
            this.inductance = Math.max(0, this.inductance);
        }
        
        // Capacitancia parásita aproximada
        if (this.length > 0) {
            this.capacitance = 1e-11 * this.length; // Aproximación simple
        }
    }

    /**
     * Dibuja el cable
     */
    draw(ctx, options = {}) {
        if (this.path.length < 2) return;
        
        ctx.save();
        
        // Configurar estilo del cable
        this.setupDrawingStyle(ctx, options);
        
        // Dibujar la ruta principal
        this.drawPath(ctx, options);
        
        // Dibujar efectos especiales
        if (this.showCurrentDirection && Math.abs(this.current) > 0.001) {
            this.drawCurrentDirection(ctx, options);
        }
        
        if (this.animateCurrentFlow && Math.abs(this.current) > 0.001) {
            this.drawAnimatedCurrent(ctx, options);
        }
        
        // Dibujar puntos de conexión
        if (options.showConnectionPoints) {
            this.drawConnectionPoints(ctx);
        }
        
        // Dibujar uniones
        if (this.junctions.length > 0) {
            this.drawJunctions(ctx, options);
        }
        
        // Dibujar información del cable si está seleccionado
        if (this.isSelected && options.showWireInfo) {
            this.drawWireInfo(ctx, options);
        }
        
        ctx.restore();
    }

    /**
     * Configura el estilo de dibujo según el estado
     */
    setupDrawingStyle(ctx, options) {
        // Color basado en corriente o estado
        if (Math.abs(this.current) > 0.001) {
            if (this.current > 0) {
                ctx.strokeStyle = '#e74c3c'; // Rojo para corriente positiva
            } else {
                ctx.strokeStyle = '#3498db'; // Azul para corriente negativa
            }
            
            // Grosor proporcional a la corriente
            const maxWidth = 6;
            const currentMagnitude = Math.abs(this.current);
            ctx.lineWidth = Math.min(maxWidth, this.width + currentMagnitude * 2);
        } else {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.width;
        }
        
        // Efectos de estado
        if (this.isSelected) {
            ctx.strokeStyle = '#f39c12';
            ctx.lineWidth += 1;
            ctx.setLineDash([5, 5]);
        } else if (this.isHighlighted) {
            ctx.strokeStyle = '#9b59b6';
            ctx.lineWidth += 1;
        }
        
        // Transparencia para cables deshabilitados
        if (options.disabled) {
            ctx.globalAlpha = 0.5;
        }
    }

    /**
     * Dibuja la ruta del cable
     */
    drawPath(ctx, options) {
        ctx.beginPath();
        ctx.moveTo(this.path[0].x, this.path[0].y);
        
        for (let i = 1; i < this.path.length; i++) {
            ctx.lineTo(this.path[i].x, this.path[i].y);
        }
        
        ctx.stroke();
        
        // Restablecer línea discontinua
        ctx.setLineDash([]);
    }

    /**
     * Dibuja la dirección de la corriente
     */
    drawCurrentDirection(ctx, options) {
        const arrowCount = Math.ceil(this.length * 100); // Más flechas para cables largos
        const arrowSize = 8;
        
        for (let i = 1; i < this.path.length; i++) {
            const start = this.path[i - 1];
            const end = this.path[i];
            const segmentLength = Math.sqrt(
                Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
            );
            
            if (segmentLength < 20) continue; // Saltar segmentos muy cortos
            
            // Calcular posición y ángulo de la flecha
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            
            // Invertir dirección si la corriente es negativa
            const actualAngle = this.current > 0 ? angle : angle + Math.PI;
            
            this.drawArrow(ctx, midX, midY, actualAngle, arrowSize);
        }
    }

    /**
     * Dibuja una flecha individual
     */
    drawArrow(ctx, x, y, angle, size) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size/2, -size/2);
        ctx.lineTo(-size/2, size/2);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }

    /**
     * Dibuja corriente animada
     */
    drawAnimatedCurrent(ctx, options) {
        const time = Date.now() / 1000;
        const speed = Math.abs(this.current) * 50; // Velocidad proporcional a corriente
        const dotSpacing = 15;
        const dotSize = 3;
        
        for (let i = 1; i < this.path.length; i++) {
            const start = this.path[i - 1];
            const end = this.path[i];
            const segmentLength = Math.sqrt(
                Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
            );
            
            const dotCount = Math.floor(segmentLength / dotSpacing);
            
            for (let j = 0; j < dotCount; j++) {
                let t = (j / dotCount + speed * time) % 1;
                if (this.current < 0) t = 1 - t; // Invertir dirección
                
                const dotX = start.x + t * (end.x - start.x);
                const dotY = start.y + t * (end.y - start.y);
                
                ctx.fillStyle = '#f39c12';
                ctx.beginPath();
                ctx.arc(dotX, dotY, dotSize, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    }

    /**
     * Dibuja puntos de conexión
     */
    drawConnectionPoints(ctx) {
        [this.start, this.end].forEach(point => {
            ctx.fillStyle = '#27ae60';
            ctx.beginPath();
            ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    }

    /**
     * Dibuja uniones con otros cables
     */
    drawJunctions(ctx, options) {
        this.junctions.forEach(junction => {
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath();
            ctx.arc(junction.x, junction.y, 8, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Indicar número de conexiones
            if (junction.connectionCount > 2) {
                ctx.fillStyle = '#e74c3c';
                ctx.font = 'bold 8px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(junction.connectionCount.toString(), junction.x, junction.y - 12);
            }
        });
    }

    /**
     * Dibuja información del cable
     */
    drawWireInfo(ctx, options) {
        const midPoint = this.getMidPoint();
        const info = [
            `${this.formatValue(this.current)}A`,
            `${this.formatValue(this.resistance)}Ω`,
            `${this.formatValue(this.length * 1000)}mm`
        ];
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(midPoint.x - 40, midPoint.y - 25, 80, 50);
        
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        
        info.forEach((text, index) => {
            ctx.fillText(text, midPoint.x, midPoint.y - 15 + index * 12);
        });
    }

    /**
     * Obtiene el punto medio del cable
     */
    getMidPoint() {
        const totalLength = this.path.length;
        const midIndex = Math.floor(totalLength / 2);
        
        if (totalLength % 2 === 1) {
            return this.path[midIndex];
        } else {
            const p1 = this.path[midIndex - 1];
            const p2 = this.path[midIndex];
            return {
                x: (p1.x + p2.x) / 2,
                y: (p1.y + p2.y) / 2
            };
        }
    }

    /**
     * Verifica si un punto está cerca del cable
     */
    isNearPoint(x, y, threshold = 5) {
        for (let i = 0; i < this.path.length - 1; i++) {
            const distance = this.distanceToSegment(
                { x, y }, 
                this.path[i], 
                this.path[i + 1]
            );
            if (distance <= threshold) {
                return true;
            }
        }
        return false;
    }

    /**
     * Calcula distancia de un punto a un segmento
     */
    distanceToSegment(point, segStart, segEnd) {
        const dx = segEnd.x - segStart.x;
        const dy = segEnd.y - segStart.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) {
            const pdx = point.x - segStart.x;
            const pdy = point.y - segStart.y;
            return Math.sqrt(pdx * pdx + pdy * pdy);
        }
        
        const t = Math.max(0, Math.min(1, 
            ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / (length * length)
        ));
        
        const projX = segStart.x + t * dx;
        const projY = segStart.y + t * dy;
        const projDx = point.x - projX;
        const projDy = point.y - projY;
        
        return Math.sqrt(projDx * projDx + projDy * projDy);
    }

    /**
     * Añade una unión en un punto específico
     */
    addJunction(x, y, connectionCount = 2) {
        const junction = {
            x, y,
            connectionCount,
            id: `junction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        
        this.junctions.push(junction);
        this.emit('junctionAdded', { wire: this, junction });
        return junction;
    }

    /**
     * Elimina una unión
     */
    removeJunction(junctionId) {
        const index = this.junctions.findIndex(j => j.id === junctionId);
        if (index > -1) {
            const junction = this.junctions.splice(index, 1)[0];
            this.emit('junctionRemoved', { wire: this, junction });
            return junction;
        }
        return null;
    }

    /**
     * Actualiza propiedades del cable
     */
    updateProperties(properties) {
        Object.keys(properties).forEach(key => {
            if (this.hasOwnProperty(key)) {
                this[key] = properties[key];
                this.lastModified = new Date();
            }
        });
        
        // Recalcular ruta si cambian puntos
        if (properties.start || properties.end || properties.orthogonal) {
            this.calculatePath();
        }
        
        // Recalcular propiedades físicas si cambian parámetros relevantes
        if (properties.material || properties.crossSection || properties.length) {
            this.updatePhysicalProperties();
        }
        
        this.emit('propertiesUpdated', { wire: this, properties });
    }

    /**
     * Análisis del cable
     */
    analyze() {
        const voltageDrop = this.current * this.resistance;
        const powerLoss = this.current * this.current * this.resistance;
        const currentDensity = Math.abs(this.current) / this.crossSection;
        
        // Límites típicos para diferentes materiales
        const maxCurrentDensity = {
            'copper': 2e6,    // A/m²
            'aluminum': 1.5e6,
            'silver': 3e6
        };
        
        const warnings = [];
        if (currentDensity > (maxCurrentDensity[this.material] || 2e6)) {
            warnings.push('Densidad de corriente excesiva');
        }
        
        if (Math.abs(this.current) > this.maxCurrent) {
            warnings.push('Corriente excede límite del cable');
        }
        
        return {
            type: 'wire',
            length: this.length,
            resistance: this.resistance,
            inductance: this.inductance,
            capacitance: this.capacitance,
            current: this.current,
            voltage: this.voltage,
            voltageDrop,
            powerLoss,
            currentDensity,
            material: this.material,
            crossSection: this.crossSection,
            temperature: this.temperature,
            junctionCount: this.junctions.length,
            warnings
        };
    }

    /**
     * Formatea valores para mostrar
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
        } else {
            return value.toExponential(2);
        }
    }

    /**
     * Convierte a JSON
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            start: this.start,
            end: this.end,
            path: this.path,
            resistance: this.resistance,
            inductance: this.inductance,
            capacitance: this.capacitance,
            maxCurrent: this.maxCurrent,
            color: this.color,
            width: this.width,
            orthogonal: this.orthogonal,
            freeDrawing: this.freeDrawing,
            snapToGrid: this.snapToGrid,
            startComponent: this.startComponent,
            endComponent: this.endComponent,
            startWire: this.startWire,
            endWire: this.endWire,
            startTerminal: this.startTerminal,
            endTerminal: this.endTerminal,
            length: this.length,
            crossSection: this.crossSection,
            material: this.material,
            junctions: this.junctions,
            createdAt: this.createdAt.toISOString(),
            lastModified: this.lastModified.toISOString()
        };
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
                    console.error(`Error in wire event listener for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Limpia recursos
     */
    dispose() {
        this.eventListeners.clear();
        this.junctions = [];
        this.path = [];
    }
}