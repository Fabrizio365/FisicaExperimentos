/**
 * Clase para componentes de resistencia
 * Extiende la funcionalidad base con características específicas de resistencias
 */
class Resistor extends Component {
    constructor(x, y, options = {}) {
        super('resistor', x, y, {
            width: 40,
            height: 20,
            value: 1000,
            unit: 'Ω',
            color: '#f39c12',
            ...options
        });
        
        // Propiedades específicas de resistencias
        this.tolerance = options.tolerance || 5; // Porcentaje de tolerancia
        this.powerRating = options.powerRating || 0.25; // Watts
        this.tempCoefficient = options.tempCoefficient || 0; // ppm/°C
        this.noiseVoltage = 0; // Voltaje de ruido térmico
        this.isVariable = options.isVariable || false; // Resistencia variable
        this.tapPosition = options.tapPosition || 0.5; // Para resistencias variables
        
        // Propiedades físicas
        this.temperature = options.temperature || 25; // °C
        this.maxVoltage = options.maxVoltage || Math.sqrt(this.value * this.powerRating);
        
        // Código de colores estándar
        this.colorCode = this.calculateColorCode();
        
        // Historial de valores para análisis
        this.valueHistory = [];
        this.temperatureHistory = [];
    }

    /**
     * Dibuja la resistencia con su forma característica
     */
    drawComponent(ctx, options = {}) {
        // Líneas de conexión
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-this.width/2 - 10, 0);
        ctx.lineTo(-this.width/2, 0);
        ctx.moveTo(this.width/2, 0);
        ctx.lineTo(this.width/2 + 10, 0);
        ctx.stroke();

        if (this.isVariable) {
            // Resistencia variable (potenciómetro)
            this.drawVariableResistor(ctx, options);
        } else {
            // Resistencia fija estándar
            this.drawFixedResistor(ctx, options);
        }

        // Mostrar código de colores si está habilitado
        if (options.showColorCode) {
            this.drawColorCode(ctx);
        }

        // Indicador de temperatura si está fuera del rango normal
        if (Math.abs(this.temperature - 25) > 10) {
            this.drawTemperatureIndicator(ctx);
        }

        // Indicador de sobrecarga
        if (this.power > this.powerRating) {
            this.drawOverloadIndicator(ctx);
        }
    }

    /**
     * Dibuja una resistencia fija
     */
    drawFixedResistor(ctx, options) {
        // Cuerpo principal
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // Borde
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // Patrón zigzag interno
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const segments = 6;
        const segmentWidth = this.width / segments;
        let x = -this.width/2;
        let y = 0;
        let up = true;
        
        ctx.moveTo(x, y);
        for (let i = 0; i < segments; i++) {
            x += segmentWidth/2;
            y = up ? -this.height/4 : this.height/4;
            ctx.lineTo(x, y);
            x += segmentWidth/2;
            y = 0;
            ctx.lineTo(x, y);
            up = !up;
        }
        ctx.stroke();
    }

    /**
     * Dibuja una resistencia variable
     */
    drawVariableResistor(ctx, options) {
        // Cuerpo base
        this.drawFixedResistor(ctx, options);
        
        // Flecha del tap
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        // Posición del tap
        const tapX = -this.width/2 + this.width * this.tapPosition;
        ctx.moveTo(tapX, -this.height/2 - 8);
        ctx.lineTo(tapX, -this.height/2);
        
        // Punta de flecha
        ctx.lineTo(tapX - 3, -this.height/2 - 3);
        ctx.moveTo(tapX, -this.height/2);
        ctx.lineTo(tapX + 3, -this.height/2 - 3);
        ctx.stroke();
        
        // Etiqueta del tap
        ctx.fillStyle = '#e74c3c';
        ctx.font = '8px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${(this.tapPosition * 100).toFixed(0)}%`, tapX, -this.height/2 - 12);
    }

    /**
     * Dibuja el código de colores de la resistencia
     */
    drawColorCode(ctx) {
        const colors = this.getColorBands();
        const bandWidth = 3;
        const startX = -this.width/2 + 5;
        
        colors.forEach((color, index) => {
            ctx.fillStyle = color;
            ctx.fillRect(startX + index * (bandWidth + 2), -this.height/2, 
                        bandWidth, this.height);
        });
    }

    /**
     * Dibuja indicador de temperatura
     */
    drawTemperatureIndicator(ctx) {
        const tempColor = this.temperature > 35 ? '#e74c3c' : '#3498db';
        ctx.fillStyle = tempColor;
        ctx.beginPath();
        ctx.arc(this.width/2 - 5, -this.height/2 + 5, 3, 0, 2 * Math.PI);
        ctx.fill();
    }

    /**
     * Dibuja indicador de sobrecarga
     */
    drawOverloadIndicator(ctx) {
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(-this.width/2 - 2, -this.height/2 - 2, 
                      this.width + 4, this.height + 4);
        ctx.setLineDash([]);
        
        // Texto de advertencia
        ctx.fillStyle = '#e74c3c';
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('!', 0, 2);
    }

    /**
     * Calcula el código de colores según el valor
     */
    calculateColorCode() {
        const colorMap = {
            0: '#000000', 1: '#8B4513', 2: '#FF0000', 3: '#FFA500',
            4: '#FFFF00', 5: '#008000', 6: '#0000FF', 7: '#800080',
            8: '#808080', 9: '#FFFFFF'
        };
        
        const toleranceColors = {
            1: '#8B4513', 2: '#FF0000', 5: '#FFD700', 10: '#C0C0C0'
        };
        
        if (this.value < 10) return ['#000000', '#000000', '#000000', '#FFD700'];
        
        let value = this.value;
        let multiplier = 0;
        
        // Normalizar a dos dígitos significativos
        while (value >= 100) {
            value /= 10;
            multiplier++;
        }
        
        const digit1 = Math.floor(value / 10);
        const digit2 = Math.floor(value % 10);
        const toleranceColor = toleranceColors[this.tolerance] || '#FFD700';
        
        return [
            colorMap[digit1],
            colorMap[digit2],
            colorMap[multiplier] || '#000000',
            toleranceColor
        ];
    }

    /**
     * Obtiene las bandas de colores
     */
    getColorBands() {
        return this.colorCode;
    }

    /**
     * Calcula la resistencia efectiva considerando temperatura
     */
    getEffectiveResistance() {
        const tempDelta = this.temperature - 25;
        const tempFactor = 1 + (this.tempCoefficient * tempDelta / 1000000);
        return this.value * tempFactor;
    }

    /**
     * Calcula el ruido térmico (Johnson noise)
     */
    calculateThermalNoise(bandwidth = 1000) {
        const k = 1.380649e-23; // Constante de Boltzmann
        const T = this.temperature + 273.15; // Temperatura en Kelvin
        const R = this.getEffectiveResistance();
        
        // Voltaje RMS de ruido térmico
        this.noiseVoltage = Math.sqrt(4 * k * T * R * bandwidth);
        return this.noiseVoltage;
    }

    /**
     * Verifica si la resistencia está dentro de sus límites
     */
    checkLimits() {
        const warnings = [];
        
        if (this.power > this.powerRating) {
            warnings.push(`Potencia excede el límite: ${this.power.toFixed(3)}W > ${this.powerRating}W`);
        }
        
        if (Math.abs(this.voltage) > this.maxVoltage) {
            warnings.push(`Voltaje excede el límite: ${Math.abs(this.voltage).toFixed(2)}V > ${this.maxVoltage.toFixed(2)}V`);
        }
        
        if (this.temperature > 85) {
            warnings.push(`Temperatura muy alta: ${this.temperature}°C`);
        }
        
        return warnings;
    }

    /**
     * Actualiza la posición del tap (para resistencias variables)
     */
    setTapPosition(position) {
        if (!this.isVariable) return;
        
        this.tapPosition = Math.max(0, Math.min(1, position));
        this.lastModified = new Date();
        this.emit('tapChanged', { component: this, position: this.tapPosition });
    }

    /**
     * Obtiene el valor en la posición del tap
     */
    getTapValue() {
        if (!this.isVariable) return this.value;
        return this.value * this.tapPosition;
    }

    /**
     * Actualiza propiedades específicas de resistencias
     */
    updateProperties(properties) {
        super.updateProperties(properties);
        
        // Actualizar código de colores si cambió el valor
        if (properties.value !== undefined) {
            this.colorCode = this.calculateColorCode();
            this.maxVoltage = Math.sqrt(this.value * this.powerRating);
        }
        
        // Actualizar ruido térmico si cambió la temperatura
        if (properties.temperature !== undefined) {
            this.temperature = properties.temperature;
            this.calculateThermalNoise();
        }
    }

    /**
     * Análisis específico de la resistencia
     */
    analyze() {
        const analysis = {
            type: 'resistor',
            value: this.value,
            effectiveValue: this.getEffectiveResistance(),
            tolerance: this.tolerance,
            powerRating: this.powerRating,
            current: this.current,
            voltage: this.voltage,
            power: this.power,
            temperature: this.temperature,
            thermalNoise: this.noiseVoltage,
            colorCode: this.colorCode,
            warnings: this.checkLimits(),
            efficiency: this.power > 0 ? (this.power / this.powerRating) * 100 : 0
        };
        
        if (this.isVariable) {
            analysis.tapPosition = this.tapPosition;
            analysis.tapValue = this.getTapValue();
        }
        
        return analysis;
    }

    /**
     * Simula el comportamiento bajo diferentes condiciones
     */
    simulate(conditions) {
        const results = {
            conditions,
            responses: {}
        };
        
        // Simular respuesta a diferentes temperaturas
        if (conditions.temperatureRange) {
            const temps = [];
            const resistances = [];
            
            for (let t = conditions.temperatureRange.min; 
                 t <= conditions.temperatureRange.max; 
                 t += conditions.temperatureRange.step || 10) {
                temps.push(t);
                const oldTemp = this.temperature;
                this.temperature = t;
                resistances.push(this.getEffectiveResistance());
                this.temperature = oldTemp;
            }
            
            results.responses.temperature = { temps, resistances };
        }
        
        // Simular respuesta en frecuencia (para altas frecuencias)
        if (conditions.frequencyRange) {
            const freqs = [];
            const impedances = [];
            
            for (let f = conditions.frequencyRange.min; 
                 f <= conditions.frequencyRange.max; 
                 f *= conditions.frequencyRange.factor || 10) {
                freqs.push(f);
                // Para resistencias puras, la impedancia es constante
                // pero en la realidad hay efectos parasitarios
                const parasiticL = 1e-9; // 1 nH parásito
                const parasiticC = 1e-12; // 1 pF parásito
                
                const XL = 2 * Math.PI * f * parasiticL;
                const XC = 1 / (2 * Math.PI * f * parasiticC);
                const X = XL - XC;
                
                const Z = Math.sqrt(this.value * this.value + X * X);
                impedances.push(Z);
            }
            
            results.responses.frequency = { freqs, impedances };
        }
        
        return results;
    }

    /**
     * Convierte a JSON con propiedades específicas
     */
    toJSON() {
        const base = super.toJSON();
        return {
            ...base,
            tolerance: this.tolerance,
            powerRating: this.powerRating,
            tempCoefficient: this.tempCoefficient,
            temperature: this.temperature,
            maxVoltage: this.maxVoltage,
            isVariable: this.isVariable,
            tapPosition: this.tapPosition,
            colorCode: this.colorCode
        };
    }

    /**
     * Crea una resistencia desde JSON
     */
    static fromJSON(data) {
        const resistor = new Resistor(data.x, data.y, {
            width: data.width,
            height: data.height,
            rotation: data.rotation,
            value: data.value,
            unit: data.unit,
            label: data.label,
            color: data.color,
            tolerance: data.tolerance,
            powerRating: data.powerRating,
            tempCoefficient: data.tempCoefficient,
            temperature: data.temperature,
            isVariable: data.isVariable,
            tapPosition: data.tapPosition
        });
        
        resistor.id = data.id;
        resistor.maxVoltage = data.maxVoltage;
        resistor.colorCode = data.colorCode;
        
        return resistor;
    }

    /**
     * Indica si permite valores negativos (no para resistencias)
     */
    allowsNegativeValues() {
        return false;
    }

    /**
     * Indica si permite valor cero (no para resistencias)
     */
    allowsZeroValue() {
        return false;
    }
}