package com.pulsesync.model;

/**
 * Representa una sala o canal de comunicación.
 */
public class Room {
    private final String id;
    private final String name;
    private final String icon;
    private final String description;
    private int onlineCount;

    public Room(String id, String name, String icon, String description) {
        this.id = id;
        this.name = name;
        this.icon = icon;
        this.description = description;
        this.onlineCount = 0;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getIcon() {
        return icon;
    }

    public String getDescription() {
        return description;
    }

    public int getOnlineCount() {
        return onlineCount;
    }

    public void setOnlineCount(int onlineCount) {
        this.onlineCount = onlineCount;
    }
}
