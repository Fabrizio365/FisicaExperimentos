/**
 * Clase para fuentes de voltaje (DC y AC)
 * Maneja fuentes ideales y reales con resistencia interna
 */
class VoltageSource extends Component {
    constructor(x, y, options = {}) {
        super('voltage', x, y, {
            width: 40,
            height: 40,
            value: 12,
            unit: 'V',
            color: '#e74c3c',
            ...options
        });
        
        // Propiedades específicas de fuentes de voltaje
        this.sourceType = options.sourceType || 'dc'; // 'dc', 'ac', 'pulse', 'ramp'
        this.internalResistance = options.internalResistance || 0; // Ohms
        this.frequency = options.frequency || 60; // Hz para AC
        this.phase = options.phase || 0; // Radianes
        this.amplitude = options.amplitude || this.value; // Amplitud para AC
        this.offset = options.offset || 0; // Offset DC para AC
        this.dutyCycle = options.dutyCycle || 0.5; // Para pulsos
        this.riseTime = options.riseTime || 0.001; // Para rampas (segundos)
        this.fallTime = options.fallTime || 0.001;
        
        // Límites de la fuente
        this.maxCurrent = options.maxCurrent || Infinity;
        this.maxPower = options.maxPower || Infinity;
        this.compliance = options.compliance || this.value * 1.1;
        
        // Estado de operación
        this.isEnabled = true;
        this.outputVoltage = this.value;
        this.outputCurrent = 0;
        this.efficiency = 0.95; // Eficiencia típica
        this.temperature = 25;
        
        // Para análisis temporal
        this.timeStep = 0;
        this.waveformData = [];
    }

    /**
     * Dibuja la fuente de voltaje
     */
    drawComponent(ctx, options = {}) {
        // Líneas de conexión
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-this.width/2, 0);
        ctx.lineTo(-this.width/2 - 10, 0);
        ctx.moveTo(this.width/2, 0);
        ctx.lineTo(this.width/2 + 10, 0);
        ctx.stroke();

        // Círculo de la fuente
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.width/2, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Dibujar símbolo según el tipo
        switch (this.sourceType) {
            case 'dc':
                this.drawDCSymbol(ctx);
                break;
            case 'ac':
                this.drawACSymbol(ctx);
                break;
            case 'pulse':
                this.drawPulseSymbol(ctx);
                break;
            case 'ramp':
                this.drawRampSymbol(ctx);
                break;
        }

        // Indicador de estado
        if (!this.isEnabled) {
            this.drawDisabledIndicator(ctx);
        }

        // Indicador de sobrecarga
        if (Math.abs(this.outputCurrent) > this.maxCurrent || 
            this.power > this.maxPower) {
            this.drawOverloadIndicator(ctx);
        }
    }

    /**
     * Dibuja símbolo de fuente DC
     */
    drawDCSymbol(ctx) {
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        
        // Polaridad
        ctx.fillText('+', -8, 4);
        ctx.fillText('−', 8, 4);
        
        // Línea divisoria
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -this.width/4);
        ctx.lineTo(0, this.width/4);
        ctx.stroke();
    }

    /**
     * Dibuja símbolo de fuente AC
     */
    drawACSymbol(ctx) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        // Forma de onda senoidal simplificada
        const points = 8;
        const amplitude = this.width/4;
        const step = (this.width * 0.8) / points;
        
        ctx.moveTo(-this.width * 0.4, 0);
        for (let i = 0; i <= points; i++) {
            const x = -this.width * 0.4 + i * step;
            const y = amplitude * Math.sin((i / points) * 2 * Math.PI);
            ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        // Indicador de frecuencia
        ctx.fillStyle = 'white';
        ctx.font = '8px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.frequency}Hz`, 0, this.width/3);
    }

    /**
     * Dibuja símbolo de fuente de pulsos
     */
    drawPulseSymbol(ctx) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const w = this.width * 0.6;
        const h = this.width/4;
        
        // Forma de onda cuadrada
        ctx.moveTo(-w/2, h/2);
        ctx.lineTo(-w/4, h/2);
        ctx.lineTo(-w/4, -h/2);
        ctx.lineTo(w/4, -h/2);
        ctx.lineTo(w/4, h/2);
        ctx.lineTo(w/2, h/2);
        ctx.stroke();
    }

    /**
     * Dibuja símbolo de fuente rampa
     */
    drawRampSymbol(ctx) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const w = this.width * 0.6;
        const h = this.width/4;
        
        // Forma de onda triangular
        ctx.moveTo(-w/2, h/2);
        ctx.lineTo(0, -h/2);
        ctx.lineTo(w/2, h/2);
        ctx.stroke();
    }

    /**
     * Dibuja indicador de fuente deshabilitada
     */
    drawDisabledIndicator(ctx) {
        ctx.strokeStyle = '#95a5a6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-this.width/3, -this.width/3);
        ctx.lineTo(this.width/3, this.width/3);
        ctx.stroke();
    }

    /**
     * Dibuja indicador de sobrecarga
     */
    drawOverloadIndicator(ctx) {
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, this.width/2 + 3, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /**
     * Calcula el voltaje de salida en un momento dado
     */
    getOutputVoltage(time = 0) {
        if (!this.isEnabled) return 0;
        
        let voltage = 0;
        
        switch (this.sourceType) {
            case 'dc':
                voltage = this.value;
                break;
                
            case 'ac':
                voltage = this.amplitude * Math.sin(2 * Math.PI * this.frequency * time + this.phase) + this.offset;
                break;
                
            case 'pulse':
                const period = 1 / this.frequency;
                const cycleTime = time % period;
                voltage = (cycleTime < period * this.dutyCycle) ? this.value : 0;
                break;
                
            case 'ramp':
                const rampPeriod = this.riseTime + this.fallTime;
                const rampCycleTime = time % rampPeriod;
                if (rampCycleTime < this.riseTime) {
                    voltage = this.value * (rampCycleTime / this.riseTime);
                } else {
                    voltage = this.value * (1 - (rampCycleTime - this.riseTime) / this.fallTime);
                }
                break;
        }
        
        // Aplicar efectos de la resistencia interna
        if (this.internalResistance > 0 && this.outputCurrent !== 0) {
            voltage -= this.outputCurrent * this.internalResistance;
        }
        
        // Limitar por compliance
        voltage = Math.max(-this.compliance, Math.min(this.compliance, voltage));
        
        this.outputVoltage = voltage;
        return voltage;
    }

    /**
     * Establece la corriente de salida y calcula efectos
     */
    setOutputCurrent(current) {
        this.outputCurrent = current;
        this.power = Math.abs(this.outputVoltage * this.outputCurrent);
        
        // Verificar límites
        if (Math.abs(current) > this.maxCurrent) {
            this.isEnabled = false;
            this.emit('overcurrent', { component: this, current });
        }
        
        if (this.power > this.maxPower) {
            this.isEnabled = false;
            this.emit('overpower', { component: this, power: this.power });
        }
    }

    /**
     * Genera forma de onda para análisis
     */
    generateWaveform(duration = 1, sampleRate = 1000) {
        const samples = Math.floor(duration * sampleRate);
        const dt = 1 / sampleRate;
        const waveform = [];
        
        for (let i = 0; i < samples; i++) {
            const time = i * dt;
            const voltage = this.getOutputVoltage(time);
            waveform.push({ time, voltage });
        }
        
        this.waveformData = waveform;
        return waveform;
    }

    /**
     * Calcula parámetros RMS y promedio
     */
    calculateWaveformParameters() {
        if (this.waveformData.length === 0) {
            this.generateWaveform();
        }
        
        const voltages = this.waveformData.map(point => point.voltage);
        const n = voltages.length;
        
        // Valor promedio
        const average = voltages.reduce((sum, v) => sum + v, 0) / n;
        
        // Valor RMS
        const rms = Math.sqrt(voltages.reduce((sum, v) => sum + v * v, 0) / n);
        
        // Valor pico a pico
        const peak = Math.max(...voltages);
        const valley = Math.min(...voltages);
        const peakToPeak = peak - valley;
        
        // Factor de forma y factor de cresta
        const formFactor = rms / Math.abs(average);
        const crestFactor = peak / rms;
        
        return {
            average,
            rms,
            peak,
            valley,
            peakToPeak,
            formFactor,
            crestFactor
        };
    }

    /**
     * Análisis de armónicos (FFT simplificado)
     */
    harmonicAnalysis() {
        if (this.sourceType === 'dc') {
            return { fundamental: this.value, harmonics: [] };
        }
        
        // Análisis simplificado para formas de onda básicas
        const analysis = { fundamental: 0, harmonics: [] };
        
        switch (this.sourceType) {
            case 'ac':
                analysis.fundamental = this.amplitude;
                break;
                
            case 'pulse':
                // Serie de Fourier para onda cuadrada
                analysis.fundamental = (4 * this.value / Math.PI) * this.dutyCycle;
                for (let n = 3; n <= 15; n += 2) {
                    const harmonic = analysis.fundamental / n;
                    analysis.harmonics.push({ order: n, amplitude: harmonic });
                }
                break;
                
            case 'ramp':
                // Serie de Fourier para onda triangular
                analysis.fundamental = 8 * this.value / (Math.PI * Math.PI);
                for (let n = 3; n <= 15; n += 2) {
                    const harmonic = analysis.fundamental / (n * n);
                    analysis.harmonics.push({ order: n, amplitude: harmonic });
                }
                break;
        }
        
        return analysis;
    }

    /**
     * Actualiza propiedades específicas
     */
    updateProperties(properties) {
        super.updateProperties(properties);
        
        // Recalcular parámetros si cambian propiedades clave
        if (properties.frequency !== undefined || 
            properties.amplitude !== undefined ||
            properties.sourceType !== undefined) {
            this.waveformData = []; // Forzar recálculo
        }
    }

    /**
     * Análisis específico de la fuente
     */
    analyze() {
        const waveformParams = this.calculateWaveformParameters();
        const harmonics = this.harmonicAnalysis();
        
        return {
            type: 'voltage_source',
            sourceType: this.sourceType,
            nominalVoltage: this.value,
            outputVoltage: this.outputVoltage,
            outputCurrent: this.outputCurrent,
            power: this.power,
            efficiency: this.efficiency,
            internalResistance: this.internalResistance,
            frequency: this.frequency,
            phase: this.phase,
            waveformParameters: waveformParams,
            harmonicAnalysis: harmonics,
            isEnabled: this.isEnabled,
            compliance: this.compliance,
            limits: {
                maxCurrent: this.maxCurrent,
                maxPower: this.maxPower
            },
            warnings: this.checkLimits()
        };
    }

    /**
     * Verifica límites de operación
     */
    checkLimits() {
        const warnings = [];
        
        if (Math.abs(this.outputCurrent) > this.maxCurrent * 0.9) {
            warnings.push(`Corriente cerca del límite: ${this.outputCurrent.toFixed(3)}A`);
        }
        
        if (this.power > this.maxPower * 0.9) {
            warnings.push(`Potencia cerca del límite: ${this.power.toFixed(2)}W`);
        }
        
        if (this.internalResistance > 0) {
            const voltageDrop = this.outputCurrent * this.internalResistance;
            const regulation = (voltageDrop / this.value) * 100;
            if (regulation > 5) {
                warnings.push(`Regulación pobre: ${regulation.toFixed(1)}%`);
            }
        }
        
        if (!this.isEnabled) {
            warnings.push('Fuente deshabilitada por protección');
        }
        
        return warnings;
    }

    /**
     * Habilita o deshabilita la fuente
     */
    enable(state = true) {
        this.isEnabled = state;
        if (!state) {
            this.outputVoltage = 0;
            this.outputCurrent = 0;
            this.power = 0;
        }
        this.emit('enableChanged', { component: this, enabled: state });
    }

    /**
     * Reset de protecciones
     */
    resetProtection() {
        this.isEnabled = true;
        this.emit('protectionReset', { component: this });
    }

    /**
     * Convierte a JSON con propiedades específicas
     */
    toJSON() {
        const base = super.toJSON();
        return {
            ...base,
            sourceType: this.sourceType,
            internalResistance: this.internalResistance,
            frequency: this.frequency,
            phase: this.phase,
            amplitude: this.amplitude,
            offset: this.offset,
            dutyCycle: this.dutyCycle,
            riseTime: this.riseTime,
            fallTime: this.fallTime,
            maxCurrent: this.maxCurrent,
            maxPower: this.maxPower,
            compliance: this.compliance,
            efficiency: this.efficiency,
            isEnabled: this.isEnabled
        };
    }

    /**
     * Crea fuente de voltaje desde JSON
     */
    static fromJSON(data) {
        const source = new VoltageSource(data.x, data.y, {
            width: data.width,
            height: data.height,
            rotation: data.rotation,
            value: data.value,
            unit: data.unit,
            label: data.label,
            color: data.color,
            sourceType: data.sourceType,
            internalResistance: data.internalResistance,
            frequency: data.frequency,
            phase: data.phase,
            amplitude: data.amplitude,
            offset: data.offset,
            dutyCycle: data.dutyCycle,
            riseTime: data.riseTime,
            fallTime: data.fallTime,
            maxCurrent: data.maxCurrent,
            maxPower: data.maxPower,
            compliance: data.compliance,
            efficiency: data.efficiency
        });
        
        source.id = data.id;
        source.isEnabled = data.isEnabled;
        
        return source;
    }

    /**
     * Permite valores negativos para voltaje
     */
    allowsNegativeValues() {
        return true;
    }

    /**
     * Permite valor cero
     */
    allowsZeroValue() {
        return true;
    }
}