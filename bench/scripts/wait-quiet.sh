#!/bin/sh
# 1분 load average 가 임계값(기본 2) 미만이 될 때까지 최대 N분(기본 30) 대기. 조용해지면 0, 시간 초과 시 1 로 종료. 매 분 상태 한 줄 출력.
max=${2:-30}; th=${1:-2}; i=0
while [ $i -lt $((max*6)) ]; do
  la=$(sysctl -n vm.loadavg | awk '{print $2}')
  ok=$(awk -v a="$la" -v t="$th" 'BEGIN{print (a<t)?1:0}')
  [ "$ok" = 1 ] && { echo "quiet load=$la after $((i*10))s"; exit 0; }
  [ $((i%6)) = 0 ] && echo "waiting load=$la t=$((i*10))s"
  sleep 10; i=$((i+1))
done
echo "timeout load=$(sysctl -n vm.loadavg)"; exit 1
