// SPDX-License-Identifier: Apache-2.0

// Package metrics defines the Prometheus collectors exported under /metrics.
// No per-child identifiers are recorded — only aggregate counters.
package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
)

// Namespace prefixes every BrightKids metric.
const Namespace = "brightkids"

// Metrics bundles the application collectors and their registry.
type Metrics struct {
	Registry *prometheus.Registry

	HTTPRequests        *prometheus.CounterVec
	HTTPRequestDuration *prometheus.HistogramVec
	LessonsCompleted    *prometheus.CounterVec
	BuildInfo           *prometheus.GaugeVec
}

// New builds the collectors, registers them (plus the standard Go and process
// collectors), and records build info.
func New(version, commit string) *Metrics {
	reg := prometheus.NewRegistry()

	m := &Metrics{
		Registry: reg,
		HTTPRequests: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Name:      "http_requests_total",
			Help:      "Total HTTP requests by method, route, and status.",
		}, []string{"method", "route", "status"}),
		HTTPRequestDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: Namespace,
			Name:      "http_request_duration_seconds",
			Help:      "HTTP request duration in seconds by route.",
			Buckets:   prometheus.DefBuckets,
		}, []string{"route"}),
		LessonsCompleted: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Name:      "lessons_completed_total",
			Help:      "Total lessons completed by subject and grade.",
		}, []string{"subject", "grade"}),
		BuildInfo: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: Namespace,
			Name:      "build_info",
			Help:      "Build information; constant 1 with version/commit labels.",
		}, []string{"version", "commit"}),
	}

	reg.MustRegister(
		m.HTTPRequests,
		m.HTTPRequestDuration,
		m.LessonsCompleted,
		m.BuildInfo,
		collectors.NewGoCollector(),
		collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
	)
	m.BuildInfo.WithLabelValues(version, commit).Set(1)
	return m
}
