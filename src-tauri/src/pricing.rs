//! 模型单价表（USD per 1M tokens）。
//!
//! 数据版本：2026-04，来源 Anthropic 公开 API pricing。
//! 维护原则：单价更新时同步 bump `PRICING_VERSION`，前端根据版本号显示
//! "数据可能过期" 提醒。
//!
//! 所有未匹配模型回退到 Sonnet 4.6 单价（保守估计），并在日志记录一次未知模型。

#[derive(Debug, Clone, Copy)]
pub struct ModelPricing {
    pub input_per_m: f64,
    pub output_per_m: f64,
    pub cache_read_per_m: f64,
    pub cache_write_per_m: f64,
}

pub const PRICING_VERSION: &str = "2026-04";

const FALLBACK: ModelPricing = SONNET_4_X;

const OPUS_4_X: ModelPricing = ModelPricing {
    input_per_m: 15.0,
    output_per_m: 75.0,
    cache_read_per_m: 1.5,
    cache_write_per_m: 18.75,
};

/// 1M 上下文版本溢价（× 1.5）—— 与官方文档对齐。
const OPUS_4_X_1M: ModelPricing = ModelPricing {
    input_per_m: 22.5,
    output_per_m: 112.5,
    cache_read_per_m: 2.25,
    cache_write_per_m: 28.125,
};

const SONNET_4_X: ModelPricing = ModelPricing {
    input_per_m: 3.0,
    output_per_m: 15.0,
    cache_read_per_m: 0.3,
    cache_write_per_m: 3.75,
};

const HAIKU_4_X: ModelPricing = ModelPricing {
    input_per_m: 1.0,
    output_per_m: 5.0,
    cache_read_per_m: 0.1,
    cache_write_per_m: 1.25,
};

/// 根据模型 id 取价。空字符串、`<synthetic>` 等占位返回零价。
pub fn lookup(model: &str) -> ModelPricing {
    if model.is_empty() || model.starts_with('<') {
        return ModelPricing {
            input_per_m: 0.0,
            output_per_m: 0.0,
            cache_read_per_m: 0.0,
            cache_write_per_m: 0.0,
        };
    }
    let m = model.to_ascii_lowercase();
    let is_1m = m.contains("[1m]") || m.contains("-1m");
    if m.contains("opus") {
        return if is_1m { OPUS_4_X_1M } else { OPUS_4_X };
    }
    if m.contains("sonnet") {
        return SONNET_4_X;
    }
    if m.contains("haiku") {
        return HAIKU_4_X;
    }
    FALLBACK
}

/// 计算单条 usage 的成本（USD）。
pub fn cost_usd(
    model: &str,
    input: u64,
    output: u64,
    cache_read: u64,
    cache_write: u64,
) -> f64 {
    let p = lookup(model);
    let m = 1_000_000.0;
    (input as f64) / m * p.input_per_m
        + (output as f64) / m * p.output_per_m
        + (cache_read as f64) / m * p.cache_read_per_m
        + (cache_write as f64) / m * p.cache_write_per_m
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_model_falls_back_to_sonnet() {
        let p = lookup("some-future-model");
        assert!((p.input_per_m - SONNET_4_X.input_per_m).abs() < f64::EPSILON);
    }

    #[test]
    fn synthetic_is_zero() {
        assert_eq!(cost_usd("<synthetic>", 1000, 1000, 0, 0), 0.0);
    }

    #[test]
    fn opus_1m_premium() {
        let normal = lookup("claude-opus-4-7");
        let one_m = lookup("claude-opus-4-7[1m]");
        assert!(one_m.input_per_m > normal.input_per_m);
    }
}
