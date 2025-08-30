current_context=$(docker context show)

docker context use rpi && docker compose -f stack.yml pull && docker stack deploy -c stack.yml quickfs

docker context use "$current_context"
